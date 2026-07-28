import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

import { encodeBase64Utf8 } from '../src/utils';

const bundleParser = async (entryPoint = 'src/resource-parser.ts'): Promise<string> => {
  const result = await build({
    bundle: true,
    entryPoints: [entryPoint],
    format: 'iife',
    platform: 'browser',
    target: ['es2017'],
    write: false,
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error('解析器 bundle 未生成');
  return output.text;
};

describe('Quantumult X runtime bundle', () => {
  it.each(['', 'f', 'fo', 'foo', '中文-🚀', '\ud800'])(
    'encodes UTF-8 Base64 compatibly for %j',
    (value) => {
      expect(encodeBase64Utf8(value)).toBe(Buffer.from(value, 'utf8').toString('base64'));
    },
  );

  it('reads $resource and returns converted content through $done', async () => {
    const bundle = await bundleParser();
    let content = '';

    vm.runInNewContext(bundle, {
      $done: (result: { content: string }) => {
        content = result.content;
      },
      $resource: {
        content: `proxies:
  - name: 运行时-🚀
    type: trojan
    server: runtime.example.com
    port: 443
    password: secret
    sni: tls.example.com`,
        type: 'server',
      },
    });

    const decoded = Buffer.from(content, 'base64').toString('utf8');
    expect(decoded).toContain('trojan=runtime.example.com:443');
    expect(decoded).toContain('tls-host=tls.example.com');
    expect(decoded).toContain('tag=运行时-🚀');
  });

  it('handles a missing $resource without throwing an undeclared-variable error', async () => {
    const bundle = await bundleParser();
    let content = 'not-empty';
    let notification = '';

    expect(() =>
      vm.runInNewContext(bundle, {
        $done: (result: { content: string }) => {
          content = result.content;
        },
        $notify: (_title: string, _subtitle: string, message: string) => {
          notification = message;
        },
      }),
    ).not.toThrow();
    expect(content).toBe('');
    expect(notification).toContain('配置内容为空');
  });

  it('reports an actionable error for a non-server resource type', async () => {
    const bundle = await bundleParser();
    let content = 'not-empty';
    let notification = '';

    vm.runInNewContext(bundle, {
      $done: (result: { content: string }) => {
        content = result.content;
      },
      $notify: (_title: string, _subtitle: string, message: string) => {
        notification = message;
      },
      $resource: { content: 'proxies: []', type: 'filter' },
    });

    expect(content).toBe('');
    expect(notification).toContain('资源类型设置为 server');
  });

  it('probe returns exactly one Base64-encoded converted node', async () => {
    const bundle = await bundleParser('src/resource-parser-probe.ts');
    let content = '';

    vm.runInNewContext(bundle, {
      $done: (result: { content: string }) => {
        content = result.content;
      },
      $resource: {
        content: `proxies:
  - name: first
    type: trojan
    server: first.example.com
    port: 443
    password: first-secret
  - name: second
    type: trojan
    server: second.example.com
    port: 443
    password: second-secret`,
      },
    });

    const decoded = Buffer.from(content, 'base64').toString('utf8');
    expect(decoded).toContain('trojan=first.example.com:443');
    expect(decoded).not.toContain('second.example.com');
  });

  it('probe exposes runtime errors as a Base64-encoded diagnostic node', async () => {
    const bundle = await bundleParser('src/resource-parser-probe.ts');
    let content = '';

    vm.runInNewContext(bundle, {
      $done: (result: { content: string }) => {
        content = result.content;
      },
      $resource: { content: 'not a supported resource' },
    });

    const decoded = Buffer.from(content, 'base64').toString('utf8');
    expect(decoded).toContain('tag=Parser-Error-ResourceParseError:');
  });

  it('static probe returns a known Base64-encoded node', () => {
    const script = readFileSync('src/static-probe.js', 'utf8');
    let content = '';

    vm.runInNewContext(script, {
      $done: (result: { content: string }) => {
        content = result.content;
      },
    });

    expect(Buffer.from(content, 'base64').toString('utf8')).toContain('tag=Parser-Static-Base64');
  });

  it('runtime probe encodes a known node with the bundled encoder', async () => {
    const bundle = await bundleParser('src/runtime-static-probe.ts');
    let content = '';

    vm.runInNewContext(bundle, {
      $done: (result: { content: string }) => {
        content = result.content;
      },
    });

    expect(Buffer.from(content, 'base64').toString('utf8')).toContain('tag=Parser-Runtime-Base64');
  });

  it.each([
    ['minimal', 'Parser-Trojan-Minimal'],
    ['options', 'Parser-Trojan-Options'],
  ] as const)('builds the %s Trojan probe variant', async (mode, expectedTag) => {
    const bundle = await bundleParser('src/resource-parser-probe.ts');
    let content = '';

    vm.runInNewContext(bundle, {
      PROBE_MODE: mode,
      $done: (result: { content: string }) => {
        content = result.content;
      },
      $resource: {
        content: `proxies:
  - name: first
    type: trojan
    server: first.example.com
    port: 443
    password: first-secret
    sni: tls.example.com`,
      },
    });

    const decoded = Buffer.from(content, 'base64').toString('utf8');
    expect(decoded).toContain(`tag=${expectedTag}`);
    expect(decoded).not.toContain('tls-host=');
    if (mode === 'minimal') expect(decoded).not.toContain('tls13=');
    if (mode === 'options') expect(decoded).toContain('tls13=false');
  });
});
