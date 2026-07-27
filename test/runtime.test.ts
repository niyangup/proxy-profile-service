import vm from 'node:vm';

import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const bundleParser = async (): Promise<string> => {
  const result = await build({
    bundle: true,
    entryPoints: ['src/resource-parser.ts'],
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
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
  - name: Runtime
    type: trojan
    server: runtime.example.com
    port: 443
    password: secret
    sni: tls.example.com`,
      },
    });

    expect(content).toContain('trojan=runtime.example.com:443');
    expect(content).toContain('tls-host=tls.example.com');
  });

  it('handles a missing $resource without throwing an undeclared-variable error', async () => {
    const bundle = await bundleParser();
    let content = 'not-called';
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
});
