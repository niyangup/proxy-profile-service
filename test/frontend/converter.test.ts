import { describe, expect, it } from 'vitest';

import { ConversionError, convertProfile } from '../../src/features/converter';
import { clashFixture, surgeFixture } from './fixtures/profiles';

const captureConversionError = (source: string): unknown => {
  try {
    convertProfile('profile.yaml', source);
    return undefined;
  } catch (error) {
    return error;
  }
};

describe('profile converter', () => {
  it('converts a Clash profile into clean Surge and Quantumult X profiles', () => {
    const result = convertProfile('profile.yaml', clashFixture);

    expect(result.sourceFormat).toBe('clash');
    expect(result.stats).toEqual({
      proxies: 1,
      groups: 2,
      rules: 4,
      skippedRules: 1,
      removedInfoNodes: 1,
    });
    expect(result.surge).toContain('HK-01 = trojan, hk.example.com, 443');
    expect(result.surge).not.toContain('Traffic: 1 GB / 100 GB = trojan');
    expect(result.quanx).toContain('trojan=hk.example.com:443');
    expect(result.quanx).toContain('host-suffix, example.com, Proxies');
    expect(result.quanx).toContain('ip-cidr, 10.0.0.0/8, direct, no-resolve');
    expect(result.quanx).not.toContain('PROCESS-NAME');
  });

  it('preserves Surge source while converting portable sections to Quantumult X', () => {
    const result = convertProfile('profile.conf', surgeFixture);

    expect(result.sourceFormat).toBe('surge');
    expect(result.surge).toBe(surgeFixture);
    expect(result.quanx).toContain('tag=HK-01');
    expect(result.quanx).not.toContain('Expire: 2099-01-01');
    expect(result.ignoredSections).toEqual(['MITM', 'Script']);
    expect(result.warnings.join(' ')).toContain('Surge 专属配置不会转换到 QX');
  });

  it('blocks unsupported proxy protocols instead of silently dropping them', () => {
    const source = clashFixture.replace('type: trojan', 'type: vmess');
    const error = captureConversionError(source);
    expect(error).toBeInstanceOf(ConversionError);
    expect((error as ConversionError).issues.join(' ')).toContain('暂不支持的协议');
  });

  it('rejects an empty profile before it can replace a published snapshot', () => {
    const error = captureConversionError('proxies: []\nproxy-groups: []\nrules: []\n');

    expect(error).toBeInstanceOf(ConversionError);
    expect((error as ConversionError).issues).toEqual(
      expect.arrayContaining([
        '配置至少需要一个可用代理节点',
        '配置至少需要一个可用策略组',
        '配置必须包含 MATCH 或 FINAL 最终规则',
      ]),
    );
  });

  it('rejects delimiter characters that would corrupt target profile syntax', () => {
    const source = clashFixture.replaceAll('HK-01', 'US, Premium');
    const error = captureConversionError(source);

    expect(error).toBeInstanceOf(ConversionError);
    expect((error as ConversionError).issues.join(' ')).toContain('不能包含逗号');
  });

  it('warns when unsupported QX rule options are omitted', () => {
    const source = clashFixture.replace(
      'DIRECT,no-resolve',
      'DIRECT,no-resolve,unsupported-option',
    );
    const result = convertProfile('profile.yaml', source);

    expect(result.quanx).toContain('ip-cidr, 10.0.0.0/8, direct, no-resolve');
    expect(result.warnings.join(' ')).toContain('unsupported-option');
  });
});
