import vm from 'node:vm';

import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const bundleParser = async (entryPoint = 'src/resource-parser.ts'): Promise<string> => {
  const result = await build({
    bundle: true,
    entryPoints: [entryPoint],
    format: 'esm',
    platform: 'browser',
    target: ['es2017'],
    write: false,
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error('解析器 bundle 未生成');
  return output.text;
};

describe('Quantumult X runtime bundle', () => {
  it('uses the top-level script shape from the official parser example', async () => {
    const bundle = await bundleParser();
    expect(bundle).not.toContain('"use strict"');
    expect(bundle).not.toMatch(/^\(\(\)\s*=>/);
  });

  it('returns native Quantumult X node lines through $done', async () => {
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

    expect(content).toContain('trojan=runtime.example.com:443');
    expect(content).toContain('tls-host=tls.example.com');
    expect(content).toContain('tag=运行时-🚀');
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
});
