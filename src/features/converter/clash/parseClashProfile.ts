import { parseDocument } from 'yaml';

import {
  ConversionError,
  type NormalizedProfile,
  type PolicyGroup,
  type ProxyNode,
  type RoutingRule,
} from '../model';
import {
  asBoolean,
  asString,
  assertSourceSize,
  ensureUniqueNames,
  isRecord,
  MAX_GROUPS,
  MAX_PROXIES,
  MAX_RULES,
  removeInfoNodes,
  validateReferences,
  validateRequiredContent,
  validateSerializableFields,
} from '../utils';

const SUPPORTED_RULE_TYPES = new Set<RoutingRule['type']>([
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'IP-CIDR',
  'IP-CIDR6',
  'GEOIP',
  'PROCESS-NAME',
  'MATCH',
  'FINAL',
]);

const parsePort = (value: unknown): number | undefined => {
  const port = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : undefined;
};

const parseProxy = (value: unknown, index: number, issues: string[]): ProxyNode | undefined => {
  if (!isRecord(value)) {
    issues.push(`第 ${index + 1} 个节点不是对象`);
    return undefined;
  }
  const name = asString(value.name);
  const type = asString(value.type)?.toLowerCase();
  if (type !== 'trojan') {
    issues.push(`节点“${name ?? index + 1}”使用了暂不支持的协议“${type ?? '未知'}”`);
    return undefined;
  }
  const server = asString(value.server);
  const port = parsePort(value.port);
  const password = asString(value.password);
  if (!name || !server || !port || !password) {
    issues.push(`Trojan 节点“${name ?? index + 1}”缺少 name、server、port 或 password`);
    return undefined;
  }
  return {
    name,
    type: 'trojan',
    server,
    port,
    password,
    sni: asString(value.sni) ?? asString(value.servername),
    skipCertificateVerification: asBoolean(value['skip-cert-verify']),
    udpRelay: asBoolean(value.udp),
    fastOpen: asBoolean(value.tfo),
  };
};

const parseGroup = (value: unknown, index: number, issues: string[]): PolicyGroup | undefined => {
  if (!isRecord(value)) {
    issues.push(`第 ${index + 1} 个策略组不是对象`);
    return undefined;
  }
  const name = asString(value.name);
  const type = asString(value.type)?.toLowerCase();
  if (type !== 'select') {
    issues.push(`策略组“${name ?? index + 1}”使用了暂不支持的类型“${type ?? '未知'}”`);
    return undefined;
  }
  const members = Array.isArray(value.proxies)
    ? value.proxies.map(asString).filter((member): member is string => Boolean(member))
    : [];
  if (!name || members.length === 0) {
    issues.push(`策略组“${name ?? index + 1}”缺少名称或成员`);
    return undefined;
  }
  return { name, type: 'select', members };
};

const parseRule = (
  value: unknown,
  index: number,
  issues: string[],
  warnings: string[],
): RoutingRule | undefined => {
  if (typeof value !== 'string') {
    issues.push(`第 ${index + 1} 条规则不是字符串`);
    return undefined;
  }
  const fields = value.split(',').map((field) => field.trim());
  const rawType = fields[0]?.toUpperCase() as RoutingRule['type'] | undefined;
  if (!rawType || !SUPPORTED_RULE_TYPES.has(rawType)) {
    warnings.push(`已跳过不支持的规则：${value}`);
    return undefined;
  }
  if (rawType === 'MATCH' || rawType === 'FINAL') {
    const policy = fields[1];
    if (!policy) {
      issues.push(`第 ${index + 1} 条最终规则缺少策略`);
      return undefined;
    }
    return { type: rawType, policy, options: fields.slice(2) };
  }
  const ruleValue = fields[1];
  const policy = fields[2];
  if (!ruleValue || !policy) {
    issues.push(`第 ${index + 1} 条规则缺少匹配值或策略`);
    return undefined;
  }
  return { type: rawType, value: ruleValue, policy, options: fields.slice(3) };
};

export const parseClashProfile = (sourceName: string, source: string): NormalizedProfile => {
  try {
    assertSourceSize(source);
  } catch (error) {
    throw new ConversionError([error instanceof Error ? error.message : '配置大小无效']);
  }

  const document = parseDocument(source, {
    strict: true,
    uniqueKeys: true,
    merge: false,
  });
  if (document.errors.length > 0) {
    throw new ConversionError(document.errors.map((error) => `YAML：${error.message}`));
  }
  const root = document.toJS({ maxAliasCount: 50 });
  if (!isRecord(root)) {
    throw new ConversionError(['Clash 配置根节点必须是对象']);
  }

  const rawProxies = Array.isArray(root.proxies) ? root.proxies : [];
  const rawGroups = Array.isArray(root['proxy-groups']) ? root['proxy-groups'] : [];
  const rawRules = Array.isArray(root.rules) ? root.rules : [];
  const countIssues = [
    rawProxies.length > MAX_PROXIES ? `节点数量超过 ${MAX_PROXIES}` : undefined,
    rawGroups.length > MAX_GROUPS ? `策略组数量超过 ${MAX_GROUPS}` : undefined,
    rawRules.length > MAX_RULES ? `规则数量超过 ${MAX_RULES}` : undefined,
  ].filter((issue): issue is string => Boolean(issue));
  if (countIssues.length > 0) {
    throw new ConversionError(countIssues);
  }

  const issues: string[] = [];
  const warnings: string[] = [];
  const parsedProxies = rawProxies
    .map((proxy, index) => parseProxy(proxy, index, issues))
    .filter((proxy): proxy is ProxyNode => Boolean(proxy));
  const parsedGroups = rawGroups
    .map((group, index) => parseGroup(group, index, issues))
    .filter((group): group is PolicyGroup => Boolean(group));
  const rules = rawRules
    .map((rule, index) => parseRule(rule, index, issues, warnings))
    .filter((rule): rule is RoutingRule => Boolean(rule));
  const filtered = removeInfoNodes(parsedProxies, parsedGroups);
  issues.push(
    ...validateRequiredContent(filtered.proxies, filtered.groups, rules),
    ...validateSerializableFields(filtered.proxies, filtered.groups, rules),
    ...ensureUniqueNames(filtered.proxies, filtered.groups),
    ...validateReferences(filtered.proxies, filtered.groups, rules),
  );
  if (issues.length > 0) {
    throw new ConversionError([...new Set(issues)]);
  }
  if (filtered.removed > 0) {
    warnings.push(`已移除 ${filtered.removed} 个流量或到期信息节点`);
  }

  return {
    sourceFormat: 'clash',
    sourceName,
    rawSource: source,
    proxies: filtered.proxies,
    groups: filtered.groups,
    rules,
    general: {
      dnsServers: ['119.29.29.29', '223.5.5.5'],
      ipv6: root.ipv6 === true,
      proxyTestUrl: 'http://www.gstatic.com/generate_204',
    },
    warnings,
    ignoredSections: [],
  };
};
