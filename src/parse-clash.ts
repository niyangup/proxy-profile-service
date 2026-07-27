import { parseDocument } from 'yaml';

import type { ProxyNode } from './model';
import { asBoolean, asInteger, asPort, asString, isRecord, type UnknownRecord } from './utils';

const parseWebSocket = (value: UnknownRecord): Pick<ProxyNode, 'wsHost' | 'wsPath'> => {
  const options = isRecord(value['ws-opts']) ? value['ws-opts'] : undefined;
  const headers = options && isRecord(options.headers) ? options.headers : undefined;
  const legacyHeaders = isRecord(value['ws-headers']) ? value['ws-headers'] : undefined;
  return {
    wsHost:
      asString(headers?.Host) ??
      asString(headers?.host) ??
      asString(legacyHeaders?.Host) ??
      asString(legacyHeaders?.host),
    wsPath: asString(options?.path) ?? asString(value['ws-path']),
  };
};

const parseReality = (
  value: UnknownRecord,
): Pick<ProxyNode, 'realityPublicKey' | 'realityShortId'> => {
  const options = isRecord(value['reality-opts']) ? value['reality-opts'] : undefined;
  const rawShortId = options?.['short-id'];
  const realityShortId =
    typeof rawShortId === 'number' && Number.isInteger(rawShortId)
      ? String(rawShortId).padStart(8, '0')
      : asString(rawShortId);
  return {
    realityPublicKey: asString(options?.['public-key']),
    realityShortId,
  };
};

const commonNode = (value: UnknownRecord): Pick<ProxyNode, 'name' | 'server' | 'port'> => {
  const name = asString(value.name);
  const server = asString(value.server);
  const port = asPort(value.port);
  if (!name || !server || !port) throw new Error('缺少 name、server 或有效 port');
  return { name, server, port };
};

const requiredSecret = (value: UnknownRecord, field: 'password' | 'uuid'): string => {
  const secret = asString(value[field]);
  if (!secret) throw new Error(`缺少 ${field}`);
  return secret;
};

const parseNode = (value: unknown): ProxyNode => {
  if (!isRecord(value)) throw new Error('节点不是对象');
  const type = asString(value.type)?.toLowerCase();
  const common = commonNode(value);
  const base = {
    ...common,
    udp: asBoolean(value.udp),
    fastOpen: asBoolean(value.tfo),
  };

  if (type === 'ss') {
    const cipher = asString(value.cipher);
    const password = requiredSecret(value, 'password');
    if (!cipher) throw new Error('Shadowsocks 缺少 cipher');
    const rawPlugin = asString(value.plugin)?.toLowerCase();
    if (rawPlugin && rawPlugin !== 'obfs' && rawPlugin !== 'v2ray-plugin') {
      throw new Error(`不支持 Shadowsocks 插件 ${rawPlugin}`);
    }
    const pluginOptions = isRecord(value['plugin-opts']) ? value['plugin-opts'] : undefined;
    const rawMode = asString(pluginOptions?.mode)?.toLowerCase();
    if (rawPlugin === 'obfs' && rawMode !== 'http' && rawMode !== 'tls') {
      throw new Error('obfs 插件需要 http 或 tls 模式');
    }
    if (rawPlugin === 'v2ray-plugin' && rawMode !== 'websocket') {
      throw new Error('v2ray-plugin 仅支持 websocket 模式');
    }
    return {
      ...base,
      type: 'ss',
      cipher,
      password,
      plugin: rawPlugin as 'obfs' | 'v2ray-plugin' | undefined,
      pluginMode: rawMode as 'http' | 'tls' | 'websocket' | undefined,
      pluginHost: asString(pluginOptions?.host),
      pluginPath: asString(pluginOptions?.path),
      pluginTls: asBoolean(pluginOptions?.tls),
    };
  }

  if (type === 'ssr') {
    const cipher = asString(value.cipher);
    const ssrProtocol = asString(value.protocol);
    const ssrObfs = asString(value.obfs);
    if (!cipher || !ssrProtocol || !ssrObfs) {
      throw new Error('SSR 缺少 cipher、protocol 或 obfs');
    }
    return {
      ...base,
      type: 'ssr',
      cipher,
      password: requiredSecret(value, 'password'),
      ssrProtocol,
      ssrProtocolParam: asString(value['protocol-param']) ?? asString(value.protocolparam),
      ssrObfs,
      ssrObfsParam: asString(value['obfs-param']) ?? asString(value.obfsparam),
    };
  }

  const networkValue = asString(value.network)?.toLowerCase();
  const network: ProxyNode['network'] =
    networkValue === 'ws' || networkValue === 'http' || networkValue === 'tcp'
      ? networkValue
      : undefined;
  if (networkValue && !network) throw new Error(`不支持传输层 ${networkValue}`);
  const sni = asString(value.sni) ?? asString(value.servername);
  const tls =
    asBoolean(value.tls) ??
    ['tls', 'reality'].includes(asString(value.security)?.toLowerCase() ?? '');
  const transport = { network, ...parseWebSocket(value) };
  const certificate = {
    sni,
    skipCertificateVerification: asBoolean(value['skip-cert-verify']),
  };

  if (type === 'trojan') {
    return {
      ...base,
      ...certificate,
      ...transport,
      type: 'trojan',
      password: requiredSecret(value, 'password'),
      tls: true,
    };
  }

  if (type === 'vmess' || type === 'vless') {
    return {
      ...base,
      ...certificate,
      ...transport,
      ...parseReality(value),
      type,
      uuid: requiredSecret(value, 'uuid'),
      tls,
      alterId: asInteger(value.alterId),
      flow: asString(value.flow),
    };
  }

  if (type === 'http' || type === 'socks5') {
    return {
      ...base,
      ...certificate,
      type,
      username: asString(value.username),
      password: asString(value.password),
      tls: asBoolean(value.tls),
    };
  }

  if (type === 'anytls') {
    return {
      ...base,
      ...certificate,
      type: 'anytls',
      password: requiredSecret(value, 'password'),
      tls: true,
    };
  }

  throw new Error(`不支持协议 ${type ?? '未知'}`);
};

export interface ParsedNodes {
  readonly nodes: readonly ProxyNode[];
  readonly sourceNodes: number;
  readonly warnings: readonly string[];
}

export const parseClash = (source: string): ParsedNodes => {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length > 0) throw new Error('YAML 语法无效');
  const root: unknown = document.toJS({ maxAliasCount: 100 });
  if (!isRecord(root) || !Array.isArray(root.proxies)) throw new Error('找不到 Clash proxies');

  const nodes: ProxyNode[] = [];
  const warnings: string[] = [];
  root.proxies.forEach((value, index) => {
    try {
      nodes.push(parseNode(value));
    } catch (error) {
      const reason = error instanceof Error ? error.message : '未知错误';
      warnings.push(`第 ${index + 1} 个节点已跳过：${reason}`);
    }
  });
  return { nodes, sourceNodes: root.proxies.length, warnings };
};
