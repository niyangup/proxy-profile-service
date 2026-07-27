import {
  ConversionError,
  type NormalizedProfile,
  type PolicyGroup,
  type ProxyNode,
  type RoutingRule,
} from '../model';
import {
  assertSourceSize,
  ensureUniqueNames,
  MAX_GROUPS,
  MAX_PROXIES,
  MAX_RULES,
  removeInfoNodes,
  splitCommaList,
  stripWrappingQuotes,
  validateReferences,
  validateRequiredContent,
  validateSerializableFields,
} from '../utils';

const SUPPORTED_SECTIONS = new Set(['General', 'Proxy', 'Proxy Group', 'Rule']);
const SUPPORTED_RULE_TYPES = new Set<RoutingRule['type']>([
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'IP-CIDR',
  'IP-CIDR6',
  'GEOIP',
  'PROCESS-NAME',
  'FINAL',
]);

interface SurgeSections {
  readonly orderedNames: readonly string[];
  readonly lines: ReadonlyMap<string, readonly string[]>;
}

const scanSections = (source: string): SurgeSections => {
  const sections = new Map<string, string[]>();
  const orderedNames: string[] = [];
  let current: string | undefined;
  for (const rawLine of source.replaceAll('\r\n', '\n').split('\n')) {
    const match = rawLine.trim().match(/^\[([^\]]+)\]$/);
    if (match?.[1]) {
      current = match[1];
      if (!sections.has(current)) {
        sections.set(current, []);
        orderedNames.push(current);
      }
      continue;
    }
    if (current) {
      sections.get(current)?.push(rawLine);
    }
  }
  return { orderedNames, lines: sections };
};

const dataLines = (lines: readonly string[]): string[] =>
  lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith(';'));

const splitAssignment = (line: string): [string, string] | undefined => {
  const separator = line.indexOf('=');
  if (separator <= 0) return undefined;
  return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
};

const parseOptions = (values: readonly string[]): ReadonlyMap<string, string> => {
  const options = new Map<string, string>();
  for (const value of values) {
    const assignment = splitAssignment(value);
    if (assignment) options.set(assignment[0].toLowerCase(), stripWrappingQuotes(assignment[1]));
  }
  return options;
};

const parseProxies = (lines: readonly string[], issues: string[]): ProxyNode[] => {
  const proxies: ProxyNode[] = [];
  for (const line of dataLines(lines)) {
    const assignment = splitAssignment(line);
    if (!assignment) {
      issues.push(`无法解析节点行：${line}`);
      continue;
    }
    const [name, expression] = assignment;
    const fields = splitCommaList(expression);
    const type = fields[0]?.toLowerCase();
    if (type === 'direct') continue;
    if (type !== 'trojan') {
      issues.push(`节点“${name}”使用了暂不支持的协议“${type ?? '未知'}”`);
      continue;
    }
    const server = fields[1];
    const port = Number(fields[2]);
    const options = parseOptions(fields.slice(3));
    const password = options.get('password');
    if (!server || !Number.isInteger(port) || port <= 0 || port > 65_535 || !password) {
      issues.push(`Trojan 节点“${name}”缺少有效 server、port 或 password`);
      continue;
    }
    proxies.push({
      name,
      type: 'trojan',
      server,
      port,
      password,
      sni: options.get('sni'),
      skipCertificateVerification: options.get('skip-cert-verify') === 'true',
      udpRelay: options.get('udp-relay') === 'true',
      fastOpen: options.get('tfo') === 'true',
    });
  }
  return proxies;
};

const parseGroups = (lines: readonly string[], issues: string[]): PolicyGroup[] => {
  const groups: PolicyGroup[] = [];
  for (const line of dataLines(lines)) {
    const assignment = splitAssignment(line);
    if (!assignment) {
      issues.push(`无法解析策略组行：${line}`);
      continue;
    }
    const [name, expression] = assignment;
    const fields = splitCommaList(expression);
    const type = fields[0]?.toLowerCase();
    if (type !== 'select') {
      issues.push(`策略组“${name}”使用了暂不支持的类型“${type ?? '未知'}”`);
      continue;
    }
    const members = fields.slice(1).map(stripWrappingQuotes).filter(Boolean);
    if (members.length === 0) {
      issues.push(`策略组“${name}”没有成员`);
      continue;
    }
    groups.push({ name, type: 'select', members });
  }
  return groups;
};

const parseRules = (
  lines: readonly string[],
  issues: string[],
  warnings: string[],
): RoutingRule[] => {
  const rules: RoutingRule[] = [];
  const skippedByType = new Map<string, number>();
  for (const line of dataLines(lines)) {
    const fields = splitCommaList(line);
    const rawType = fields[0]?.toUpperCase() ?? 'UNKNOWN';
    const type = rawType as RoutingRule['type'];
    if (!SUPPORTED_RULE_TYPES.has(type)) {
      skippedByType.set(rawType, (skippedByType.get(rawType) ?? 0) + 1);
      continue;
    }
    if (type === 'FINAL') {
      const policy = fields[1];
      if (!policy) issues.push('FINAL 规则缺少策略');
      else rules.push({ type, policy, options: fields.slice(2) });
      continue;
    }
    const value = fields[1];
    const policy = fields[2];
    if (!value || !policy) {
      issues.push(`规则缺少匹配值或策略：${line}`);
      continue;
    }
    rules.push({ type, value, policy, options: fields.slice(3) });
  }
  if (skippedByType.size > 0) {
    const summary = [...skippedByType].map(([type, count]) => `${type} ${count} 条`).join('、');
    const total = [...skippedByType.values()].reduce((sum, count) => sum + count, 0);
    warnings.push(`QX 输出已跳过 ${total} 条 Surge 专属规则（${summary}）`);
    warnings.push('如同时提供 Clash YAML，建议上传 YAML 以保留展开后的完整分流规则');
  }
  return rules;
};

const parseGeneral = (lines: readonly string[]) => {
  const values = new Map<string, string>();
  for (const line of dataLines(lines)) {
    const assignment = splitAssignment(line);
    if (assignment) values.set(assignment[0].toLowerCase(), assignment[1]);
  }
  return {
    dnsServers: values
      .get('dns-server')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? ['119.29.29.29'],
    ipv6: false,
    proxyTestUrl: values.get('proxy-test-url') ?? 'http://www.gstatic.com/generate_204',
  };
};

export const parseSurgeProfile = (sourceName: string, source: string): NormalizedProfile => {
  try {
    assertSourceSize(source);
  } catch (error) {
    throw new ConversionError([error instanceof Error ? error.message : '配置大小无效']);
  }
  const sections = scanSections(source);
  if (
    !sections.lines.has('Proxy') ||
    !sections.lines.has('Proxy Group') ||
    !sections.lines.has('Rule')
  ) {
    throw new ConversionError(['Surge 配置必须包含 [Proxy]、[Proxy Group] 和 [Rule]']);
  }
  const issues: string[] = [];
  const warnings: string[] = [];
  const parsedProxies = parseProxies(sections.lines.get('Proxy') ?? [], issues);
  const parsedGroups = parseGroups(sections.lines.get('Proxy Group') ?? [], issues);
  const rules = parseRules(sections.lines.get('Rule') ?? [], issues, warnings);
  if (
    parsedProxies.length > MAX_PROXIES ||
    parsedGroups.length > MAX_GROUPS ||
    rules.length > MAX_RULES
  ) {
    issues.push('节点、策略组或规则数量超过服务限制');
  }
  const filtered = removeInfoNodes(parsedProxies, parsedGroups);
  issues.push(
    ...validateRequiredContent(filtered.proxies, filtered.groups, rules),
    ...validateSerializableFields(filtered.proxies, filtered.groups, rules),
    ...ensureUniqueNames(filtered.proxies, filtered.groups),
    ...validateReferences(filtered.proxies, filtered.groups, rules),
  );
  if (issues.length > 0) throw new ConversionError([...new Set(issues)]);
  if (filtered.removed > 0) warnings.push(`QX 输出已移除 ${filtered.removed} 个流量或到期信息节点`);

  const ignoredSections = sections.orderedNames.filter((name) => !SUPPORTED_SECTIONS.has(name));
  if (ignoredSections.length > 0) {
    warnings.push(`以下 Surge 专属配置不会转换到 QX：${ignoredSections.join('、')}`);
  }
  return {
    sourceFormat: 'surge',
    sourceName,
    rawSource: source,
    proxies: filtered.proxies,
    groups: filtered.groups,
    rules,
    general: parseGeneral(sections.lines.get('General') ?? []),
    warnings,
    ignoredSections,
  };
};
