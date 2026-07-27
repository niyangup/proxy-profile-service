import { describe, expect, it } from 'vitest';

import { ConversionError, convertProfile } from '../../src/features/converter';
import { clashFixture, surgeFixture } from './fixtures/profiles';

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
    const captureError = (): unknown => {
      try {
        convertProfile('profile.yaml', source);
        return undefined;
      } catch (error) {
        return error;
      }
    };

    const error = captureError();
    expect(error).toBeInstanceOf(ConversionError);
    expect((error as ConversionError).issues.join(' ')).toContain('暂不支持的协议');
  });
});
