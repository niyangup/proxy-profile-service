import { convertResource } from './index';
import { encodeBase64Utf8 } from './utils';

interface QuantumultResource {
  readonly content?: string;
}

declare const $resource: QuantumultResource | undefined;
declare const $done: (result: { readonly content: string }) => void;

const diagnosticNode = (message: string): string => {
  const tag = message.replace(/[\r\n,=]/g, ' ').slice(0, 120);
  return `shadowsocks=example.com:80, method=chacha20, password=pwd, fast-open=false, udp-relay=false, tag=Parser-Error-${tag}`;
};

try {
  const source = typeof $resource === 'undefined' ? '' : ($resource.content ?? '');
  const firstNode = convertResource(source).content.split('\n')[0] ?? '';
  $done({ content: encodeBase64Utf8(firstNode) });
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  $done({ content: encodeBase64Utf8(diagnosticNode(message)) });
}
