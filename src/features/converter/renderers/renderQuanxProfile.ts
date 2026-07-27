import type { NormalizedProfile, ProxyNode, RoutingRule } from '../model';

const QX_RULE_TYPES: Readonly<
  Record<Exclude<RoutingRule['type'], 'MATCH' | 'FINAL' | 'PROCESS-NAME'>, string>
> = {
  DOMAIN: 'host',
  'DOMAIN-SUFFIX': 'host-suffix',
  'DOMAIN-KEYWORD': 'host-keyword',
  'IP-CIDR': 'ip-cidr',
  'IP-CIDR6': 'ip6-cidr',
  GEOIP: 'geoip',
};

const normalizePolicy = (policy: string): string => {
  const builtIn = policy.toUpperCase();
  if (builtIn === 'DIRECT') return 'direct';
  if (builtIn === 'REJECT' || builtIn === 'REJECT-DROP') return 'reject';
  return policy;
};

const renderProxy = (proxy: ProxyNode): string => {
  const options = [
    `password=${proxy.password}`,
    'over-tls=true',
    proxy.sni ? `tls-host=${proxy.sni}` : undefined,
    `tls-verification=${proxy.skipCertificateVerification ? 'false' : 'true'}`,
    `fast-open=${proxy.fastOpen ? 'true' : 'false'}`,
    `udp-relay=${proxy.udpRelay ? 'true' : 'false'}`,
    `tag=${proxy.name}`,
  ].filter((option): option is string => Boolean(option));
  return `trojan=${proxy.server}:${proxy.port}, ${options.join(', ')}`;
};

const renderRule = (rule: RoutingRule): string | undefined => {
  if (rule.type === 'PROCESS-NAME') return undefined;
  if (rule.type === 'MATCH' || rule.type === 'FINAL') {
    return `final, ${normalizePolicy(rule.policy)}`;
  }
  return `${QX_RULE_TYPES[rule.type]}, ${rule.value}, ${normalizePolicy(rule.policy)}`;
};

export const renderQuanxProfile = (
  profile: NormalizedProfile,
): { content: string; skippedRules: number } => {
  const renderedRules = profile.rules.map(renderRule);
  const skippedRules = renderedRules.filter((rule) => !rule).length;
  const dnsLines = profile.general.dnsServers.map((server) => `server = ${server}`);
  const lines = [
    '[general]',
    `server_check_url = ${profile.general.proxyTestUrl}`,
    'dns_exclusion_list = *.local, localhost',
    'excluded_routes = 192.168.0.0/16, 172.16.0.0/12, 100.64.0.0/10, 10.0.0.0/8',
    '',
    '[dns]',
    ...(profile.general.ipv6 ? [] : ['no-ipv6']),
    ...dnsLines,
    '',
    '[policy]',
    ...profile.groups.map(
      (group) => `static = ${group.name}, ${group.members.map(normalizePolicy).join(', ')}`,
    ),
    '',
    '[server_local]',
    ...profile.proxies.map(renderProxy),
    '',
    '[filter_local]',
    ...renderedRules.filter((rule): rule is string => Boolean(rule)),
    '',
  ];
  return { content: lines.join('\n'), skippedRules };
};
