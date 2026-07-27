import type { PolicyGroup, ProxyNode, RoutingRule } from './model';

export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const MAX_PROXIES = 2_000;
export const MAX_GROUPS = 500;
export const MAX_RULES = 50_000;

const INFO_NODE_PATTERN = /(?:traffic|expire|流量|到期|剩余)/i;
const BUILT_IN_POLICIES = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PROXY']);
const UNSAFE_NAME_PATTERN = /[\r\n,=]/;
const UNSAFE_VALUE_PATTERN = /[\r\n,]/;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

export const assertSourceSize = (source: string): void => {
  const size = new TextEncoder().encode(source).byteLength;
  if (size === 0) {
    throw new Error('配置文件为空');
  }
  if (size > MAX_SOURCE_BYTES) {
    throw new Error(`配置文件超过 ${MAX_SOURCE_BYTES / 1024 / 1024} MB 限制`);
  }
};

export const splitCommaList = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if ((character === '"' || character === "'") && line[index - 1] !== '\\') {
      quote = quote === character ? undefined : (quote ?? character);
      current += character;
      continue;
    }
    if (character === ',' && !quote) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  values.push(current.trim());
  return values;
};

export const stripWrappingQuotes = (value: string): string => {
  const first = value[0];
  const last = value.at(-1);
  return value.length >= 2 && first === last && (first === '"' || first === "'")
    ? value.slice(1, -1)
    : value;
};

export const removeInfoNodes = (
  proxies: readonly ProxyNode[],
  groups: readonly PolicyGroup[],
): { proxies: ProxyNode[]; groups: PolicyGroup[]; removed: number } => {
  const removedNames = new Set(
    proxies.filter((proxy) => INFO_NODE_PATTERN.test(proxy.name)).map((proxy) => proxy.name),
  );
  return {
    proxies: proxies.filter((proxy) => !removedNames.has(proxy.name)),
    groups: groups.map((group) => ({
      ...group,
      members: group.members.filter((member) => !removedNames.has(member)),
    })),
    removed: removedNames.size,
  };
};

export const validateReferences = (
  proxies: readonly ProxyNode[],
  groups: readonly PolicyGroup[],
  rules: readonly RoutingRule[],
): string[] => {
  const issues: string[] = [];
  const proxyNames = new Set(proxies.map((proxy) => proxy.name));
  const groupNames = new Set(groups.map((group) => group.name));
  const knownPolicy = (name: string) =>
    BUILT_IN_POLICIES.has(name.toUpperCase()) || proxyNames.has(name) || groupNames.has(name);

  for (const group of groups) {
    if (group.members.length === 0) {
      issues.push(`策略组“${group.name}”没有可用成员`);
    }
    for (const member of group.members) {
      if (!knownPolicy(member)) {
        issues.push(`策略组“${group.name}”引用了不存在的成员“${member}”`);
      }
    }
  }

  for (const rule of rules) {
    if (!knownPolicy(rule.policy)) {
      issues.push(`规则引用了不存在的策略“${rule.policy}”`);
    }
  }
  return [...new Set(issues)];
};

export const ensureUniqueNames = (
  proxies: readonly ProxyNode[],
  groups: readonly PolicyGroup[],
): string[] => {
  const issues: string[] = [];
  const names = new Set<string>();
  for (const name of [
    ...proxies.map((proxy) => proxy.name),
    ...groups.map((group) => group.name),
  ]) {
    if (names.has(name)) {
      issues.push(`节点或策略名称重复：“${name}”`);
    }
    names.add(name);
  }
  return issues;
};

export const validateRequiredContent = (
  proxies: readonly ProxyNode[],
  groups: readonly PolicyGroup[],
  rules: readonly RoutingRule[],
): string[] => {
  const issues: string[] = [];
  if (proxies.length === 0) issues.push('配置至少需要一个可用代理节点');
  if (groups.length === 0) issues.push('配置至少需要一个可用策略组');
  if (!rules.some((rule) => rule.type === 'MATCH' || rule.type === 'FINAL')) {
    issues.push('配置必须包含 MATCH 或 FINAL 最终规则');
  }
  return issues;
};

export const validateSerializableFields = (
  proxies: readonly ProxyNode[],
  groups: readonly PolicyGroup[],
  rules: readonly RoutingRule[],
): string[] => {
  const issues: string[] = [];
  const validateName = (kind: string, value: string) => {
    if (UNSAFE_NAME_PATTERN.test(value)) {
      issues.push(`${kind}“${value}”不能包含逗号、等号或换行`);
    }
  };
  const validateValue = (kind: string, value: string | undefined) => {
    if (value && UNSAFE_VALUE_PATTERN.test(value)) {
      issues.push(`${kind}不能包含逗号或换行`);
    }
  };

  for (const proxy of proxies) {
    validateName('节点名称', proxy.name);
    validateValue(`节点“${proxy.name}”的服务器地址`, proxy.server);
    validateValue(`节点“${proxy.name}”的密码`, proxy.password);
    validateValue(`节点“${proxy.name}”的 SNI`, proxy.sni);
  }
  for (const group of groups) {
    validateName('策略组名称', group.name);
    for (const member of group.members) validateName('策略成员名称', member);
  }
  for (const rule of rules) {
    validateName('规则策略名称', rule.policy);
    validateValue('规则匹配值', rule.value);
    for (const option of rule.options) validateValue('规则选项', option);
  }
  return [...new Set(issues)];
};
