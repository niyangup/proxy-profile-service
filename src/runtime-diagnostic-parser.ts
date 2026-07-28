import { convertResource } from './index';

interface QuantumultResource {
  readonly content?: string;
  readonly type?: string;
}

declare const $resource: QuantumultResource | undefined;
declare const $done: (result: { readonly content: string }) => void;

const diagnosticNode = (message: string): string => {
  const tag = message.replace(/[\r\n,]/g, ' ').slice(0, 160);
  return `shadowsocks=example.com:80, method=chacha20, password=pwd, fast-open=false, udp-relay=false, tag=Parser-Error-${tag}`;
};

try {
  const resource = typeof $resource === 'undefined' ? undefined : $resource;
  const result = convertResource(resource?.content ?? '');
  $done({ content: result.content.split('\n')[0] ?? '' });
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  $done({ content: diagnosticNode(message) });
}
