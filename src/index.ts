import type { ConversionResult, SourceFormat } from './model';
import { ResourceParseError } from './model';
import { parseClash } from './parse-clash';
import { parseSurge } from './parse-surge';
import { renderNode } from './render';
import { isInfoNode, MAX_NODES, MAX_SOURCE_BYTES, utf8ByteLength } from './utils';

const detectFormat = (source: string): SourceFormat => {
  if (/^\s*\[Proxy\]\s*$/im.test(source)) return 'surge';
  if (/(?:^|\n)\s*(?:proxies|"proxies")\s*:/i.test(source)) return 'clash';
  throw new ResourceParseError('无法识别输入，请提供 Clash YAML 或包含 [Proxy] 的 Surge CONF');
};

export const convertResource = (source: string): ConversionResult => {
  if (!source.trim()) throw new ResourceParseError('配置内容为空');
  if (utf8ByteLength(source) > MAX_SOURCE_BYTES) {
    throw new ResourceParseError('配置超过 5 MB 限制');
  }

  const sourceFormat = detectFormat(source);
  let parsed;
  try {
    parsed = sourceFormat === 'clash' ? parseClash(source) : parseSurge(source);
  } catch (error) {
    throw new ResourceParseError(error instanceof Error ? error.message : '配置解析失败');
  }
  if (parsed.sourceNodes > MAX_NODES) throw new ResourceParseError('节点数量超过 5000 个限制');

  const warnings = [...parsed.warnings];
  const lines: string[] = [];
  for (const node of parsed.nodes) {
    if (isInfoNode(node.name)) {
      warnings.push('已过滤一个流量或到期信息节点');
      continue;
    }
    try {
      lines.push(renderNode(node));
    } catch (error) {
      const reason = error instanceof Error ? error.message : '未知错误';
      warnings.push(`一个节点在输出时已跳过：${reason}`);
    }
  }
  if (lines.length === 0) throw new ResourceParseError('没有可以转换为 Quantumult X 的节点');

  return {
    content: lines.join('\n'),
    sourceFormat,
    sourceNodes: parsed.sourceNodes,
    convertedNodes: lines.length,
    skippedNodes: parsed.sourceNodes - lines.length,
    warnings,
  };
};

export { ResourceParseError } from './model';
