import type { ProxyNode } from './model';
import { asBoolean, asInteger, asPort, asString, isRecord, type UnknownRecord } from './utils';

const YAML_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

const indentation = (line: string): number => line.match(/^ */)?.[0].length ?? 0;

const stripYamlComment = (value: string): string => {
  let quote = '';
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\' && quote === '"') {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '#' && (index === 0 || /\s/.test(value[index - 1] ?? ''))) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value.trimEnd();
};

const splitYamlFields = (value: string): string[] => {
  const fields: string[] = [];
  let current = '';
  let quote = '';
  let escaped = false;
  let depth = 0;
  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === '\\' && quote === '"') {
      current += character;
      escaped = true;
    } else if (quote) {
      current += character;
      if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      current += character;
      quote = character;
    } else if (character === '{' || character === '[') {
      current += character;
      depth += 1;
    } else if (character === '}' || character === ']') {
      current += character;
      depth -= 1;
    } else if (character === ',' && depth === 0) {
      fields.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (quote || depth !== 0) throw new Error('YAML 行内结构未闭合');
  fields.push(current.trim());
  return fields;
};

const yamlSeparator = (value: string): number => {
  let quote = '';
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\' && quote === '"') {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '{' || character === '[') {
      depth += 1;
    } else if (character === '}' || character === ']') {
      depth -= 1;
    } else if (character === ':' && depth === 0) {
      return index;
    }
  }
  return -1;
};

const parseYamlKey = (value: string): string => {
  const key = value.trim();
  const unquoted =
    (key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))
      ? key.slice(1, -1)
      : key;
  if (!YAML_KEY_PATTERN.test(unquoted)) throw new Error(`YAML 字段名无效：${unquoted}`);
  if (unquoted === '__proto__' || unquoted === 'constructor' || unquoted === 'prototype') {
    throw new Error('YAML 包含不安全字段名');
  }
  return unquoted;
};

const parseYamlScalar = (rawValue: string): unknown => {
  const value = stripYamlComment(rawValue).trim();
  if (!value) return '';
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error('YAML 双引号字符串无效');
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith('{') && value.endsWith('}')) return parseInlineMap(value.slice(1, -1));
  if (value.startsWith('[') && value.endsWith(']')) {
    return splitYamlFields(value.slice(1, -1)).map(parseYamlScalar);
  }
  if (/^(?:true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^(?:null|~)$/i.test(value)) return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
};

const setYamlField = (record: UnknownRecord, key: string, value: unknown): void => {
  if (Object.prototype.hasOwnProperty.call(record, key)) throw new Error(`YAML 字段重复：${key}`);
  record[key] = value;
};

function parseInlineMap(value: string): UnknownRecord {
  const record: UnknownRecord = {};
  for (const field of splitYamlFields(value)) {
    if (!field) continue;
    const separator = yamlSeparator(field);
    if (separator <= 0) throw new Error('YAML 行内对象无效');
    setYamlField(
      record,
      parseYamlKey(field.slice(0, separator)),
      parseYamlScalar(field.slice(separator + 1)),
    );
  }
  return record;
}

const parseProxySequence = (source: string): unknown[] => {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((line) =>
    /^\s*(?:proxies|["']proxies["'])\s*:\s*(?:#.*)?$/.test(line),
  );
  if (start < 0) throw new Error('找不到 Clash proxies');
  const baseIndent = indentation(lines[start] ?? '');
  const nodes: UnknownRecord[] = [];
  let current: UnknownRecord | undefined;
  let itemIndent = -1;
  let frames: Array<{ readonly indent: number; readonly record: UnknownRecord }> = [];

  for (let index = start + 1; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    const withoutComment = stripYamlComment(rawLine);
    if (!withoutComment.trim()) continue;
    const lineIndent = indentation(rawLine);
    const trimmed = withoutComment.trim();
    if (lineIndent <= baseIndent) break;

    if (trimmed.startsWith('-') && (itemIndent < 0 || lineIndent === itemIndent)) {
      itemIndent = lineIndent;
      current = {};
      nodes.push(current);
      frames = [{ indent: itemIndent, record: current }];
      const remainder = trimmed.slice(1).trim();
      if (!remainder) continue;
      if (remainder.startsWith('{') && remainder.endsWith('}')) {
        Object.assign(current, parseInlineMap(remainder.slice(1, -1)));
        continue;
      }
      const separator = yamlSeparator(remainder);
      if (separator <= 0) throw new Error(`第 ${index + 1} 行 YAML 节点无效`);
      const key = parseYamlKey(remainder.slice(0, separator));
      const rawValue = remainder.slice(separator + 1);
      if (stripYamlComment(rawValue).trim()) {
        setYamlField(current, key, parseYamlScalar(rawValue));
      } else {
        const child: UnknownRecord = {};
        setYamlField(current, key, child);
        frames.push({ indent: itemIndent + 2, record: child });
      }
      continue;
    }

    if (!current || itemIndent < 0 || lineIndent <= itemIndent) continue;
    const separator = yamlSeparator(trimmed);
    if (separator <= 0) throw new Error(`第 ${index + 1} 行 YAML 字段无效`);
    while (frames.length > 1 && (frames[frames.length - 1]?.indent ?? -1) >= lineIndent) {
      frames.pop();
    }
    const parent = frames[frames.length - 1]?.record;
    if (!parent) throw new Error(`第 ${index + 1} 行 YAML 缩进无效`);
    const key = parseYamlKey(trimmed.slice(0, separator));
    const rawValue = trimmed.slice(separator + 1);
    if (stripYamlComment(rawValue).trim()) {
      setYamlField(parent, key, parseYamlScalar(rawValue));
    } else {
      const child: UnknownRecord = {};
      setYamlField(parent, key, child);
      frames.push({ indent: lineIndent, record: child });
    }
  }
  return nodes;
};

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
  const proxies = parseProxySequence(source);

  const nodes: ProxyNode[] = [];
  const warnings: string[] = [];
  proxies.forEach((value, index) => {
    try {
      nodes.push(parseNode(value));
    } catch (error) {
      const reason = error instanceof Error ? error.message : '未知错误';
      warnings.push(`第 ${index + 1} 个节点已跳过：${reason}`);
    }
  });
  return { nodes, sourceNodes: proxies.length, warnings };
};
