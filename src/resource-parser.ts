import { convertResource, ResourceParseError } from './index';

interface QuantumultResource {
  readonly content?: string;
  readonly type?: string;
}

declare const $resource: QuantumultResource | undefined;
declare const $done: (result: { readonly content: string }) => void;
declare const $notify: ((title: string, subtitle?: string, message?: string) => void) | undefined;

const notify = (title: string, subtitle: string, message: string): void => {
  if (typeof $notify === 'function') $notify(title, subtitle, message);
};

try {
  const resource = typeof $resource === 'undefined' ? undefined : $resource;
  if (resource?.type && resource.type !== 'server') {
    throw new ResourceParseError('请将远程资源类型设置为 server');
  }
  const source = resource?.content ?? '';
  const result = convertResource(source);
  if (result.skippedNodes > 0) {
    notify(
      'Quantumult X 资源解析完成',
      `已转换 ${result.convertedNodes} 个节点，跳过 ${result.skippedNodes} 个`,
      result.warnings.slice(0, 3).join('\n'),
    );
  }
  // Quantumult X's official resource-parser example returns native node lines.
  $done({ content: result.content });
} catch (error) {
  const message =
    error instanceof ResourceParseError || error instanceof Error ? error.message : '未知错误';
  notify('Quantumult X 资源解析失败', '', message);
  $done({ content: '' });
}
