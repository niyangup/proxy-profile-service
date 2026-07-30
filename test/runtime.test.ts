import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = new URL('../', import.meta.url);
let bundle = '';

interface RuntimeResource {
  readonly content: string;
  readonly type: string;
  readonly link?: string;
}

interface RuntimeResult {
  readonly content?: string;
  readonly [key: string]: unknown;
}

const runParser = (resource?: RuntimeResource) => {
  const results: RuntimeResult[] = [];
  const notifications: string[] = [];
  const parser: Record<string, unknown> = {};
  const context = {
    $done: (result: RuntimeResult) => results.push(result),
    $environment: { version: '1.5.6 build999' },
    $notify: (title: string, subtitle: string, message: string) => {
      notifications.push([title, subtitle, message].filter(Boolean).join(' '));
    },
    $parser: parser,
    $resource: resource
      ? {
          info: '',
          link: resource.link ?? 'https://input.example/subscription',
          tag: 'Synthetic test',
          user_agent: '',
          ...resource,
        }
      : undefined,
    console: { log: () => undefined },
  };

  vm.runInNewContext(bundle, context);
  return { notifications, parser, results };
};

const decodeBase64 = (value: string): string => Buffer.from(value, 'base64').toString('utf8');

beforeAll(() => {
  execFileSync(process.execPath, ['scripts/build.mjs'], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
  bundle = readFileSync(new URL('../dist/resource-parser.js', import.meta.url), 'utf8');
});

describe('Quantumult X runtime bundle', () => {
  it('uses the top-level script shape from the official parser example', () => {
    expect(Buffer.byteLength(bundle)).toBeLessThan(240 * 1024);
    expect(bundle).toMatch(/^\/\* Quantumult X Resource Parser .+KOP-XIAO: [0-9a-f]{12}/);
    expect(bundle).not.toContain('"use strict"');
    expect(bundle).not.toMatch(/^\(\(\)\s*=>/);
    expect(bundle).not.toMatch(/\bexport\s/);
    expect(bundle).toContain('function executeVendoredKop(');
  });

  it('keeps the verified native Clash path and installs the KOP parameter helper', () => {
    const runtime = runParser({
      content: `proxies:
  - name: 运行时-🚀
    type: trojan
    server: runtime.example.com
    port: 443
    password: fake-secret
    sni: tls.example.com`,
      type: 'server',
    });

    expect(runtime.results).toHaveLength(1);
    expect(runtime.results[0]?.content).toContain('trojan=runtime.example.com:443');
    expect(runtime.results[0]?.content).toContain('tls-host=tls.example.com');
    expect(runtime.results[0]?.content).toContain('tag=运行时-🚀');
    expect(runtime.parser.hashSchema).toBeTypeOf('function');
    expect(runtime.parser.hashToUI).toBeTypeOf('function');
    expect(runtime.parser.uiToHash).toBeTypeOf('function');
  });

  it('falls back to KOP for another server format and calls $done exactly once', () => {
    const shareLink = `ss://${Buffer.from('aes-128-gcm:fake-secret@ss.example.com:443').toString(
      'base64',
    )}#Fallback`;
    const runtime = runParser({ content: shareLink, type: 'server' });

    expect(runtime.results).toHaveLength(1);
    expect(runtime.results[0]).toEqual({ content: expect.any(String) });
    const decoded = decodeBase64(runtime.results[0]?.content ?? '');
    expect(decoded).toContain('shadowsocks=ss.example.com:443');
    expect(decoded).toContain('tag=Fallback');
  });

  it('falls back to KOP when the native Clash parser cannot parse valid upstream syntax', () => {
    const runtime = runParser({
      content: `proxies:
  - &node {name: Anchored, type: trojan, server: anchor.example.com, port: 443, password: fake-secret}`,
      type: 'server',
    });

    expect(runtime.results).toHaveLength(1);
    expect(runtime.results[0]).toEqual({ content: expect.any(String) });
    const decoded = decodeBase64(runtime.results[0]?.content ?? '');
    expect(decoded).toContain('trojan=anchor.example.com:443');
    expect(decoded).toContain('tag=Anchored');
  });

  it('applies KOP server parameters after native conversion', () => {
    const runtime = runParser({
      content: `proxies:
  - name: Native
    type: trojan
    server: native.example.com
    port: 443
    password: fake-secret`,
      link: 'https://input.example/subscription#rename=Native@Changed',
      type: 'server',
    });

    expect(runtime.results).toHaveLength(1);
    expect(runtime.results[0]).toEqual({ content: expect.any(String) });
    const decoded = decodeBase64(runtime.results[0]?.content ?? '');
    expect(decoded).toContain('trojan=native.example.com:443');
    expect(decoded).toContain('tag=Changed');
  });

  it('delegates filter and rewrite resources to KOP', () => {
    const filter = runParser({
      content: 'DOMAIN-SUFFIX,example.com,Proxy',
      type: 'filter',
    });
    const rewrite = runParser({
      content: '^https://example\\.com/v1 url reject',
      type: 'rewrite',
    });

    expect(filter.results).toHaveLength(1);
    expect(filter.results[0]).toEqual({ content: 'host-SUFFIX, example.com, Proxy' });
    expect(filter.results[0]?.content).toBe('host-SUFFIX, example.com, Proxy');
    expect(rewrite.results).toHaveLength(1);
    expect(rewrite.results[0]).toEqual({ content: 'https://example\\.com/v1 url reject' });
    expect(rewrite.results[0]?.content).toBe('https://example\\.com/v1 url reject');
  });

  it('handles a missing $resource without throwing an undeclared-variable error', () => {
    const runtime = runParser();

    expect(runtime.results).toEqual([{ content: '' }]);
    expect(runtime.notifications.join(' ')).toContain('KOP-XIAO 回退解析器执行失败');
  });
});
