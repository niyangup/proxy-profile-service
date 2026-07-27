import type { ProxyNode } from './model';

export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_NODES = 5_000;

const INFO_NODE_PATTERN = /(?:traffic|expire|流量|到期|剩余|套餐)/i;
const UNSAFE_VALUE_PATTERN = /[\r\n,]/;
const BASE64_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

export const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return undefined;
};

export const asPort = (value: unknown): number | undefined => {
  const port = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : undefined;
};

export const asInteger = (value: unknown): number | undefined => {
  const integer = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(integer) ? integer : undefined;
};

export const isInfoNode = (name: string): boolean => INFO_NODE_PATTERN.test(name);

export const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
};

export const encodeBase64Utf8 = (value: string): string => {
  let result = '';
  let buffer = 0;
  let bits = 0;

  const appendByte = (byte: number): void => {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      result += BASE64_CHARACTERS[(buffer >> bits) & 0x3f];
    }
    buffer = bits === 0 ? 0 : buffer & ((1 << bits) - 1);
  };

  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);
    let codePoint = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(index + 1);
      if (second >= 0xdc00 && second <= 0xdfff) {
        codePoint = 0x1_0000 + ((first - 0xd800) << 10) + (second - 0xdc00);
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      codePoint = 0xfffd;
    }

    if (codePoint < 0x80) {
      appendByte(codePoint);
    } else if (codePoint < 0x800) {
      appendByte(0xc0 | (codePoint >> 6));
      appendByte(0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x1_0000) {
      appendByte(0xe0 | (codePoint >> 12));
      appendByte(0x80 | ((codePoint >> 6) & 0x3f));
      appendByte(0x80 | (codePoint & 0x3f));
    } else {
      appendByte(0xf0 | (codePoint >> 18));
      appendByte(0x80 | ((codePoint >> 12) & 0x3f));
      appendByte(0x80 | ((codePoint >> 6) & 0x3f));
      appendByte(0x80 | (codePoint & 0x3f));
    }
  }

  if (bits > 0) result += BASE64_CHARACTERS[(buffer << (6 - bits)) & 0x3f];
  while (result.length % 4 !== 0) result += '=';
  return result;
};

export const assertSafeNode = (node: ProxyNode): void => {
  if (
    Object.values(node).some(
      (value) => typeof value === 'string' && UNSAFE_VALUE_PATTERN.test(value),
    )
  ) {
    throw new Error('包含无法安全写入 Quantumult X 节点行的逗号或换行');
  }
};

export const formatEndpoint = (server: string, port: number): string => {
  const host = server.includes(':') && !server.startsWith('[') ? `[${server}]` : server;
  return `${host}:${port}`;
};

export const stripQuotes = (value: string): string => {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

export const splitCommaList = (value: string): string[] => {
  const fields: string[] = [];
  let current = '';
  let quote = '';
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === '\\') {
      current += character;
      escaped = true;
    } else if (quote) {
      current += character;
      if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      current += character;
      quote = character;
    } else if (character === ',') {
      fields.push(stripQuotes(current));
      current = '';
    } else {
      current += character;
    }
  }
  fields.push(stripQuotes(current));
  return fields.map((field) => field.trim());
};

export const optionMap = (fields: readonly string[]): ReadonlyMap<string, string> => {
  const options = new Map<string, string>();
  for (const field of fields) {
    const separator = field.indexOf('=');
    if (separator <= 0) continue;
    options.set(
      field.slice(0, separator).trim().toLowerCase(),
      stripQuotes(field.slice(separator + 1)),
    );
  }
  return options;
};
