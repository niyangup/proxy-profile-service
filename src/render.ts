import type { ProxyNode } from './model';
import { assertSafeNode, formatEndpoint } from './utils';

const booleanOption = (name: string, value: boolean | undefined): string | undefined =>
  value === undefined ? undefined : `${name}=${value ? 'true' : 'false'}`;

const tlsOptions = (node: ProxyNode): Array<string | undefined> => [
  node.sni ? `tls-host=${node.sni}` : undefined,
  booleanOption(
    'tls-verification',
    node.skipCertificateVerification === undefined ? undefined : !node.skipCertificateVerification,
  ),
];

const transportOptions = (node: ProxyNode): Array<string | undefined> => {
  if (node.network === 'ws') {
    return [
      `obfs=${node.tls ? 'wss' : 'ws'}`,
      node.wsHost ? `obfs-host=${node.wsHost}` : undefined,
      node.wsPath ? `obfs-uri=${node.wsPath}` : undefined,
    ];
  }
  if (node.network === 'http') return ['obfs=http'];
  return node.tls ? ['obfs=over-tls'] : [];
};

const finish = (node: ProxyNode, fields: Array<string | undefined>): string =>
  [
    ...fields,
    booleanOption('fast-open', node.fastOpen ?? false),
    booleanOption('udp-relay', node.udp ?? false),
    `tag=${node.name}`,
  ]
    .filter((field): field is string => Boolean(field))
    .join(', ');

export const renderNode = (node: ProxyNode): string => {
  assertSafeNode(node);
  const endpoint = formatEndpoint(node.server, node.port);

  if (node.type === 'ss' || node.type === 'ssr') {
    if (!node.cipher || !node.password) throw new Error('Shadowsocks 缺少 cipher 或 password');
    const pluginOptions: Array<string | undefined> = [];
    if (node.type === 'ss' && node.plugin) {
      if (node.plugin === 'obfs') {
        pluginOptions.push(`obfs=${node.pluginMode}`);
      } else {
        pluginOptions.push(`obfs=${node.pluginTls ? 'wss' : 'ws'}`);
      }
      pluginOptions.push(
        node.pluginHost ? `obfs-host=${node.pluginHost}` : undefined,
        node.pluginPath ? `obfs-uri=${node.pluginPath}` : undefined,
      );
    }
    if (node.type === 'ssr') {
      pluginOptions.push(
        `ssr-protocol=${node.ssrProtocol}`,
        node.ssrProtocolParam ? `ssr-protocol-param=${node.ssrProtocolParam}` : undefined,
        `obfs=${node.ssrObfs}`,
        node.ssrObfsParam ? `obfs-host=${node.ssrObfsParam}` : undefined,
      );
    }
    return `shadowsocks=${finish(node, [
      endpoint,
      `method=${node.cipher}`,
      `password=${node.password}`,
      ...pluginOptions,
    ])}`;
  }

  if (node.type === 'trojan') {
    if (!node.password) throw new Error('Trojan 缺少 password');
    const transport =
      node.network === 'ws' ? transportOptions(node) : ['over-tls=true', ...tlsOptions(node)];
    if (node.network === 'ws') transport.push(...tlsOptions(node));
    return `trojan=${finish(node, [
      endpoint,
      `password=${node.password}`,
      ...transport,
      'tls13=false',
    ])}`;
  }

  if (node.type === 'vmess' || node.type === 'vless') {
    if (!node.uuid) throw new Error(`${node.type} 缺少 uuid`);
    const prefix = node.type;
    const fields = [
      endpoint,
      `method=${node.type === 'vmess' ? 'aes-128-gcm' : 'none'}`,
      `password=${node.uuid}`,
      ...transportOptions(node),
      ...(node.tls ? tlsOptions(node) : []),
      node.type === 'vmess' && node.alterId && node.alterId !== 0 ? 'aead=false' : undefined,
      node.type === 'vless' && node.flow ? `vless-flow=${node.flow}` : undefined,
      node.realityPublicKey ? `reality-base64-pubkey=${node.realityPublicKey}` : undefined,
      node.realityShortId ? `reality-hex-shortid=${node.realityShortId}` : undefined,
    ];
    return `${prefix}=${finish(node, fields)}`;
  }

  if (node.type === 'http' || node.type === 'socks5') {
    return `${node.type}=${finish(node, [
      endpoint,
      node.username ? `username=${node.username}` : undefined,
      node.password ? `password=${node.password}` : undefined,
      node.tls ? 'over-tls=true' : undefined,
      ...(node.tls ? tlsOptions(node) : []),
    ])}`;
  }

  if (node.type === 'anytls') {
    if (!node.password) throw new Error('AnyTLS 缺少 password');
    return `anytls=${finish(node, [
      endpoint,
      `password=${node.password}`,
      'over-tls=true',
      ...tlsOptions(node),
    ])}`;
  }

  throw new Error(`不支持协议 ${node.type}`);
};
