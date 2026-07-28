import vm from 'node:vm';

import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const bundleParser = async (): Promise<string> => {
  const result = await build({
    bundle: true,
    entryPoints: ['src/resource-parser.ts'],
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

    expect(content).toContain('trojan=runtime.example.com:443');
    expect(content).toContain('tls-host=tls.example.com');
    expect(content).toContain('tag=运行时-🚀');
  });

  it('handles a missing $resource without throwing an undeclared-variable error', async () => {
    const bundle = await bundleParser();
    let errorMessage = '';
    let notification = '';

    expect(() =>
      vm.runInNewContext(bundle, {
        $done: (result: { error?: string }) => {
          errorMessage = result.error ?? '';
        },
        $notify: (_title: string, _subtitle: string, message: string) => {
          notification = message;
        },
      }),
    ).not.toThrow();
    expect(errorMessage).toContain('配置内容为空');
    expect(notification).toContain('配置内容为空');
  });

  it('reports an actionable error for a non-server resource type', async () => {
    const bundle = await bundleParser();
    let errorMessage = '';

    vm.runInNewContext(bundle, {
      $done: (result: { error?: string }) => {
        errorMessage = result.error ?? '';
      },
      $resource: { content: 'proxies: []', type: 'filter' },
    });

    expect(errorMessage).toContain('资源类型设置为 server');
  });
});
