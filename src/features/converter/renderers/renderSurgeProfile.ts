import type { NormalizedProfile, ProxyNode, RoutingRule } from '../model';

const booleanOption = (name: string, value: boolean): string =>
  `${name}=${value ? 'true' : 'false'}`;

const renderProxy = (proxy: ProxyNode): string => {
  const options = [
    `password=${proxy.password}`,
    proxy.sni ? `sni=${proxy.sni}` : undefined,
    booleanOption('skip-cert-verify', proxy.skipCertificateVerification),
    booleanOption('tfo', proxy.fastOpen),
    booleanOption('udp-relay', proxy.udpRelay),
  ].filter((option): option is string => Boolean(option));
  return `${proxy.name} = trojan, ${proxy.server}, ${proxy.port}, ${options.join(', ')}`;
};

const renderRule = (rule: RoutingRule): string => {
  const type = rule.type === 'MATCH' ? 'FINAL' : rule.type;
  return [type, rule.value, rule.policy, ...rule.options].filter(Boolean).join(',');
};

export const renderSurgeProfile = (profile: NormalizedProfile): string => {
  if (profile.sourceFormat === 'surge') return profile.rawSource;

  const general = [
    '[General]',
    'loglevel = notify',
    `dns-server = ${profile.general.dnsServers.join(', ')}`,
    `proxy-test-url = ${profile.general.proxyTestUrl}`,
    'skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, localhost, *.local',
    '',
  ];
  const proxies = ['[Proxy]', 'DIRECT = direct', ...profile.proxies.map(renderProxy), ''];
  const groups = [
    '[Proxy Group]',
    ...profile.groups.map((group) => `${group.name} = select, ${group.members.join(', ')}`),
    '',
  ];
  const rules = ['[Rule]', ...profile.rules.map(renderRule), ''];
  return [...general, ...proxies, ...groups, ...rules].join('\n');
};
