import { encodeBase64Utf8 } from './utils';

declare const $done: (result: { readonly content: string }) => void;

const node =
  'shadowsocks=example.com:80, method=chacha20, password=pwd, fast-open=false, udp-relay=false, tag=Parser-Runtime-Base64';

$done({ content: encodeBase64Utf8(node) });
