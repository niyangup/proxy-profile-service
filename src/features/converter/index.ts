import { parseClashProfile } from './clash/parseClashProfile';
import {
  ConversionError,
  type ConvertedProfile,
  type NormalizedProfile,
  type SourceFormat,
} from './model';
import { renderQuanxProfile } from './renderers/renderQuanxProfile';
import { renderSurgeProfile } from './renderers/renderSurgeProfile';
import { parseSurgeProfile } from './surge/parseSurgeProfile';

const detectFormat = (source: string): SourceFormat => {
  if (/^\s*\[(?:General|Proxy|Proxy Group|Rule)\]/m.test(source)) return 'surge';
  if (/^\s*(?:proxies|proxy-groups|rules)\s*:/m.test(source)) return 'clash';
  throw new ConversionError(['无法识别配置格式，请上传 Clash YAML 或 Surge CONF']);
};

const normalize = (sourceName: string, source: string): NormalizedProfile =>
  detectFormat(source) === 'surge'
    ? parseSurgeProfile(sourceName, source)
    : parseClashProfile(sourceName, source);

const countRemovedNodes = (warnings: readonly string[]): number => {
  const warning = warnings.find((item) => item.includes('流量或到期信息节点'));
  const count = warning?.match(/\d+/)?.[0];
  return count ? Number(count) : 0;
};

export const convertProfile = (sourceName: string, source: string): ConvertedProfile => {
  const profile = normalize(sourceName, source);
  const quanx = renderQuanxProfile(profile);
  const warnings = [...profile.warnings];
  if (quanx.skippedRules > 0) warnings.push(`QX 输出已跳过 ${quanx.skippedRules} 条进程规则`);
  if (quanx.ignoredOptions.length > 0) {
    warnings.push(`QX 输出已忽略不支持的规则选项：${quanx.ignoredOptions.join('、')}`);
  }
  return {
    sourceFormat: profile.sourceFormat,
    sourceName,
    source,
    surge: renderSurgeProfile(profile),
    quanx: quanx.content,
    warnings,
    ignoredSections: profile.ignoredSections,
    stats: {
      proxies: profile.proxies.length,
      groups: profile.groups.length,
      rules: profile.rules.length,
      skippedRules: quanx.skippedRules,
      removedInfoNodes: countRemovedNodes(profile.warnings),
    },
  };
};

export { ConversionError } from './model';
export type { ConvertedProfile, ConversionStats, SourceFormat } from './model';
