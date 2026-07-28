import { convertResource } from './index';
import { encodeBase64Utf8 } from './utils';

interface QuantumultResource {
  readonly content?: string;
}

declare const $resource: QuantumultResource | undefined;
declare const $done: (result: { readonly content: string }) => void;
declare const PROBE_MODE: 'full' | 'minimal' | 'options' | undefined;

const diagnosticNode = (message: string): string => {
  const tag = message.replace(/[\r\n,=]/g, ' ').slice(0, 120);
  return `shadowsocks=example.com:80, method=chacha20, password=pwd, fast-open=false, udp-relay=false, tag=Parser-Error-${tag}`;
};

try {
  const source = typeof $resource === 'undefined' ? '' : ($resource.content ?? '');
  const firstNode = convertResource(source).content.split('\n')[0] ?? '';
  const mode = typeof PROBE_MODE === 'undefined' ? 'full' : PROBE_MODE;
  const fields = firstNode.split(', ');
  const endpoint = fields[0];
  const field = (name: string): string | undefined =>
    fields.find((value) => value.startsWith(`${name}=`));

  let content = firstNode;
  if (mode === 'minimal') {
    content = [endpoint, field('password'), field('over-tls'), 'tag=Parser-Trojan-Minimal']
      .filter(Boolean)
      .join(', ');
  } else if (mode === 'options') {
    content = [
      endpoint,
      field('password'),
      field('over-tls'),
      field('tls-verification'),
      field('tls13'),
      field('udp-relay'),
      field('fast-open'),
      'tag=Parser-Trojan-Options',
    ]
      .filter(Boolean)
      .join(', ');
  }

  $done({ content: encodeBase64Utf8(content) });
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  $done({ content: encodeBase64Utf8(diagnosticNode(message)) });
}
