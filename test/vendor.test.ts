import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const vendorFile = new URL('../vendor/kop-xiao/resource-parser.js', import.meta.url);
const metadataFile = new URL('../vendor/kop-xiao/upstream.json', import.meta.url);

describe('vendored KOP-XIAO parser', () => {
  it('matches the pinned commit metadata byte-for-byte', () => {
    const source = readFileSync(vendorFile);
    const metadata = JSON.parse(readFileSync(metadataFile, 'utf8'));

    expect(metadata.repository).toBe('https://github.com/KOP-XIAO/QuantumultX');
    expect(metadata.path).toBe('Scripts/resource-parser.js');
    expect(metadata.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(metadata.sourceUrl).toContain(metadata.commit);
    expect(createHash('sha256').update(source).digest('hex')).toBe(metadata.sha256);
    expect(source.toString('utf8')).toContain('资源解析器 ©𝐒𝐡𝐚𝐰𝐧');
  });
});
