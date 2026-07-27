import type { ProxyNode } from './model';
import { asInteger, asPort, optionMap, splitCommaList } from './utils';

const truthy = (value: string | undefined): boolean | undefined => {
  if (value === undefined) return undefined;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return undefined;
};

const websocketHost = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  for (const header of value.split('|')) {
    const match = header.trim().match(/^Host\s*:\s*(.+)$/i);
    if (match?.[1]) return match[1].replace(/^['"]|['"]$/g, '').trim() || undefined;
  }
  return undefined;
};

const parseNode = (name: string, expression: string): ProxyNode | undefined => {
  const fields = splitCommaList(expression);
  const rawType = fields[0]?.toLowerCase();
  if (rawType === 'direct') return undefined;
  const server = fields[1];
  const port = asPort(fields[2]);
  if (!rawType || !server || !port) throw new Error('缺少协议、server 或有效 port');
  const options = optionMap(fields.slice(3));
  const common = {
    name,
    server,
    port,
    udp: truthy(options.get('udp-relay')),
    fastOpen: truthy(options.get('tfo')),
  };

  if (rawType === 'ss' || rawType === 'shadowsocks') {
    const cipher = options.get('encrypt-method') ?? options.get('method');
    const password = options.get('password');
    if (!cipher || !password) throw new Error('Shadowsocks 缺少加密方式或密码');
    const rawObfs = options.get('obfs')?.toLowerCase();
    if (rawObfs && rawObfs !== 'http' && rawObfs !== 'tls') {
      throw new Error(`不支持 Shadowsocks obfs ${rawObfs}`);
    }
    return {
      ...common,
      type: 'ss',
      cipher,
      password,
      plugin: rawObfs ? 'obfs' : undefined,
      pluginMode: rawObfs as 'http' | 'tls' | undefined,
      pluginHost: options.get('obfs-host'),
    };
  }

  if (rawType === 'trojan') {
    const password = options.get('password');
    if (!password) throw new Error('Trojan 缺少密码');
    return {
      ...common,
      type: 'trojan',
      password,
      sni: options.get('sni'),
      skipCertificateVerification: truthy(options.get('skip-cert-verify')),
      tls: true,
    };
  }

  if (rawType === 'vmess') {
    const uuid = options.get('username') ?? options.get('uuid');
    if (!uuid) throw new Error('VMess 缺少 username/uuid');
    const websocket = truthy(options.get('ws')) === true;
    return {
      ...common,
      type: 'vmess',
      uuid,
      tls: truthy(options.get('tls')),
      network: websocket ? 'ws' : 'tcp',
      wsHost: websocketHost(options.get('ws-headers')),
      wsPath: options.get('ws-path'),
      sni: options.get('sni'),
      skipCertificateVerification: truthy(options.get('skip-cert-verify')),
      alterId: asInteger(options.get('alter-id')) ?? 0,
    };
  }

  if (rawType === 'http' || rawType === 'https') {
    return {
      ...common,
      type: 'http',
      username: options.get('username'),
      password: options.get('password'),
      tls: rawType === 'https' || truthy(options.get('tls')),
      sni: options.get('sni'),
      skipCertificateVerification: truthy(options.get('skip-cert-verify')),
    };
  }

  if (rawType === 'socks5' || rawType === 'socks5-tls') {
    return {
      ...common,
      type: 'socks5',
      username: options.get('username'),
      password: options.get('password'),
      tls: rawType === 'socks5-tls',
      sni: options.get('sni'),
      skipCertificateVerification: truthy(options.get('skip-cert-verify')),
    };
  }

  if (rawType === 'anytls') {
    const password = options.get('password');
    if (!password) throw new Error('AnyTLS 缺少密码');
    return {
      ...common,
      type: 'anytls',
      password,
      tls: true,
      sni: options.get('sni'),
      skipCertificateVerification: truthy(options.get('skip-cert-verify')),
    };
  }

  throw new Error(`不支持协议 ${rawType}`);
};

export interface ParsedNodes {
  readonly nodes: readonly ProxyNode[];
  readonly sourceNodes: number;
  readonly warnings: readonly string[];
}

export const parseSurge = (source: string): ParsedNodes => {
  const nodes: ProxyNode[] = [];
  const warnings: string[] = [];
  let inProxySection = false;
  let sourceNodes = 0;
  for (const rawLine of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    const section = line.match(/^\[([^\]]+)\]$/)?.[1];
    if (section) {
      inProxySection = section.toLowerCase() === 'proxy';
      continue;
    }
    if (!inProxySection || !line || line.startsWith('#') || line.startsWith(';')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    sourceNodes += 1;
    const name = line.slice(0, separator).trim();
    try {
      const node = parseNode(name, line.slice(separator + 1).trim());
      if (node) nodes.push(node);
    } catch (error) {
      const reason = error instanceof Error ? error.message : '未知错误';
      warnings.push(`第 ${sourceNodes} 个节点已跳过：${reason}`);
    }
  }
  if (sourceNodes === 0) throw new Error('找不到 Surge [Proxy] 节点');
  return { nodes, sourceNodes, warnings };
};
