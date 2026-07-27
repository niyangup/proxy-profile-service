import { describe, expect, it } from 'vitest';

import { convertResource, ResourceParseError } from '../src';

const clashTrojan = `
proxies:
  - name: HK-01
    type: trojan
    server: origin.example.com
    port: 443
    password: test-password
    sni: edge.example.com
    skip-cert-verify: true
    udp: true
    tfo: true
`;

const clashShadowsocks = `
proxies:
  - name: SS-01
    type: ss
    server: ss.example.com
    port: 443
    cipher: aes-128-gcm
    password: test-password
    plugin: obfs
    plugin-opts:
      mode: http
      host: edge.example.com
`;

describe('resource conversion', () => {
  it('preserves Trojan SNI as the Quantumult X tls-host', () => {
    const result = convertResource(clashTrojan);

    expect(result.sourceFormat).toBe('clash');
    expect(result.convertedNodes).toBe(1);
    expect(result.content).toContain('trojan=origin.example.com:443');
    expect(result.content).toContain('tls-host=edge.example.com');
    expect(result.content).toContain('tls-verification=false');
    expect(result.content).toContain('tls13=false');
    expect(result.content).toContain('fast-open=true');
    expect(result.content).toContain('udp-relay=true');
  });

  it('converts Shadowsocks simple-obfs options', () => {
    const result = convertResource(clashShadowsocks);

    expect(result.content).toContain('shadowsocks=ss.example.com:443');
    expect(result.content).toContain('method=aes-128-gcm');
    expect(result.content).toContain('obfs=http');
    expect(result.content).toContain('obfs-host=edge.example.com');
  });

  it('converts VLESS Reality fields supported by Quantumult X', () => {
    const result = convertResource(`
proxies:
  - name: VLESS-01
    type: vless
    server: vless.example.com
    port: 443
    uuid: 00000000-0000-4000-8000-000000000001
    security: reality
    servername: edge.example.com
    flow: xtls-rprx-vision
    reality-opts:
      public-key: public-key-value
      short-id: 01234567
`);

    expect(result.content).toContain('vless=vless.example.com:443');
    expect(result.content).toContain('obfs=over-tls');
    expect(result.content).toContain('tls-host=edge.example.com');
    expect(result.content).toContain('vless-flow=xtls-rprx-vision');
    expect(result.content).toContain('reality-base64-pubkey=public-key-value');
    expect(result.content).toContain('reality-hex-shortid=01234567');
  });

  it('converts Surge Trojan nodes and ignores unrelated sections', () => {
    const result = convertResource(`[General]
dns-server = 1.1.1.1

[Proxy]
HK-01 = trojan, origin.example.com, 443, password=test-password, sni=edge.example.com, skip-cert-verify=true

[Rule]
FINAL,DIRECT
`);

    expect(result.sourceFormat).toBe('surge');
    expect(result.convertedNodes).toBe(1);
    expect(result.content).toContain('tls-host=edge.example.com');
    expect(result.content).not.toContain('[Rule]');
  });

  it('filters information nodes and reports unsupported nodes', () => {
    const result = convertResource(`
proxies:
  - name: "Traffic: 1 GB"
    type: trojan
    server: info.example.com
    port: 443
    password: info
  - name: Unsupported
    type: hysteria2
    server: unsupported.example.com
    port: 443
    password: test
  - name: HK-01
    type: trojan
    server: origin.example.com
    port: 443
    password: test
    sni: edge.example.com
`);

    expect(result.sourceNodes).toBe(3);
    expect(result.convertedNodes).toBe(1);
    expect(result.skippedNodes).toBe(2);
    expect(result.warnings.join(' ')).toContain('不支持协议 hysteria2');
    expect(result.warnings.join(' ')).toContain('信息节点');
  });

  it('rejects content that is not a supported resource', () => {
    expect(() => convertResource('hello')).toThrow(ResourceParseError);
  });

  it('converts VMess WebSocket over TLS and IPv6 endpoints', () => {
    const result = convertResource(`
proxies:
  - name: VMess-WS
    type: vmess
    server: 2001:db8::1
    port: 443
    uuid: 00000000-0000-4000-8000-000000000002
    tls: true
    servername: tls.example.com
    network: ws
    ws-opts:
      path: /socket
      headers:
        Host: ws.example.com
`);

    expect(result.content).toContain('vmess=[2001:db8::1]:443');
    expect(result.content).toContain('obfs=wss');
    expect(result.content).toContain('obfs-host=ws.example.com');
    expect(result.content).toContain('obfs-uri=/socket');
    expect(result.content).toContain('tls-host=tls.example.com');
  });

  it('converts SSR and v2ray-plugin Shadowsocks nodes', () => {
    const result = convertResource(`
proxies:
  - name: SSR-01
    type: ssr
    server: ssr.example.com
    port: 8443
    cipher: aes-256-cfb
    password: secret
    protocol: auth_sha1_v4
    protocol-param: user
    obfs: tls1.2_ticket_auth
    obfs-param: edge.example.com
  - name: SS-WS
    type: ss
    server: ss.example.com
    port: 443
    cipher: aes-128-gcm
    password: secret
    plugin: v2ray-plugin
    plugin-opts:
      mode: websocket
      tls: true
      host: ws.example.com
      path: /ss
`);

    expect(result.content).toContain('ssr-protocol=auth_sha1_v4');
    expect(result.content).toContain('ssr-protocol-param=user');
    expect(result.content).toContain('obfs=tls1.2_ticket_auth');
    expect(result.content).toContain('obfs=wss');
    expect(result.content).toContain('obfs-uri=/ss');
  });

  it('converts Surge HTTP, SOCKS5, AnyTLS, and VMess nodes', () => {
    const result = convertResource(`[Proxy]
Web = https, http.example.com, 443, username=user, password=secret, sni=tls.example.com
Socks = socks5-tls, socks.example.com, 443, username=user, password=secret
Any = anytls, any.example.com, 443, password=secret, sni=any-tls.example.com
VMess = vmess, vmess.example.com, 443, username=00000000-0000-4000-8000-000000000003, tls=true, ws=true, ws-path=/socket, ws-headers=User-Agent:test|Host:ws.example.com
`);

    expect(result.convertedNodes).toBe(4);
    expect(result.content).toContain('http=http.example.com:443');
    expect(result.content).toContain('socks5=socks.example.com:443');
    expect(result.content).toContain('anytls=any.example.com:443');
    expect(result.content).toContain('vmess=vmess.example.com:443');
    expect(result.content).toContain('obfs-host=ws.example.com');
  });

  it('fails when every source node is unsupported', () => {
    expect(() =>
      convertResource(`
proxies:
  - name: Unsupported
    type: hysteria2
    server: unsupported.example.com
    port: 443
    password: secret
`),
    ).toThrow('没有可以转换');
  });

  it('skips values that could inject another Quantumult X field', () => {
    const result = convertResource(`
proxies:
  - name: Unsafe
    type: trojan
    server: unsafe.example.com
    port: 443
    password: "secret, udp-relay=false"
  - name: Safe
    type: trojan
    server: safe.example.com
    port: 443
    password: secret
`);

    expect(result.convertedNodes).toBe(1);
    expect(result.skippedNodes).toBe(1);
    expect(result.warnings.join(' ')).toContain('无法安全写入');
  });

  it('rejects resources above the node limit', () => {
    const proxies = Array.from(
      { length: 5_001 },
      (_, index) =>
        `  - {name: n${index}, type: trojan, server: example.com, port: 443, password: secret}`,
    ).join('\n');

    expect(() => convertResource(`proxies:\n${proxies}`)).toThrow('节点数量超过 5000');
  });
});
