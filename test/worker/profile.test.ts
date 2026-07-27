import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PublishRequest } from '../../shared/contracts/profile';

const ADMIN_TOKEN = 'local-admin-token-change-me';
const SUBSCRIPTION_TOKEN = 'local-subscription-token-change-me';
const payload: PublishRequest = {
  sourceName: 'profile.yaml',
  sourceFormat: 'clash',
  source: 'proxies: []',
  surge:
    '[General]\n\n[Proxy]\nDIRECT = direct\n\n[Proxy Group]\nFinal = select, DIRECT\n\n[Rule]\nFINAL,Final\n',
  quanx:
    '[general]\n\n[dns]\nserver = 119.29.29.29\n\n[policy]\nstatic = Final, direct\n\n[server_local]\ntrojan=example.com:443, password=test, over-tls=true, tag=Test\n\n[filter_local]\nfinal, Final\n',
  warnings: [],
  ignoredSections: [],
  stats: { proxies: 1, groups: 1, rules: 1, skippedRules: 0, removedInfoNodes: 0 },
};

const publish = (token = ADMIN_TOKEN) =>
  SELF.fetch('https://example.com/api/publish', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

describe('profile worker', () => {
  beforeEach(async () => {
    const objects = await env.PROFILE_BUCKET.list();
    if (objects.objects.length > 0) {
      await env.PROFILE_BUCKET.delete(objects.objects.map((object) => object.key));
    }
  });

  it('rejects invalid administration and subscription tokens', async () => {
    expect((await publish('wrong')).status).toBe(401);
    expect((await SELF.fetch('https://example.com/sub/surge.conf')).status).toBe(404);
    expect((await SELF.fetch('https://example.com/sub/surge.conf?p=wrong')).status).toBe(404);
  });

  it('publishes one atomic version and serves both fixed URLs', async () => {
    const response = await publish();
    expect(response.status).toBe(201);
    const result = (await response.json()) as { urls: { surge: string; quanx: string } };
    expect(result.urls).toEqual({
      surge: `https://example.com/sub/surge.conf?p=${SUBSCRIPTION_TOKEN}`,
      quanx: `https://example.com/sub/quanx.conf?p=${SUBSCRIPTION_TOKEN}`,
    });

    const surge = await SELF.fetch(result.urls.surge);
    const quanx = await SELF.fetch(result.urls.quanx);
    expect(surge.status).toBe(200);
    expect(await surge.text()).toBe(payload.surge);
    expect(await quanx.text()).toBe(payload.quanx);
    expect(surge.headers.get('Cache-Control')).toBe('private, no-store');

    const conditional = await SELF.fetch(result.urls.surge, {
      headers: { 'If-None-Match': surge.headers.get('ETag') ?? '' },
    });
    expect(conditional.status).toBe(304);
  });

  it('returns current metadata only to an administrator', async () => {
    await publish();
    const response = await SELF.fetch('https://example.com/api/status', {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      current: { sourceName: string; sourceFormat: string };
    };
    expect(result.current).toMatchObject({ sourceName: 'profile.yaml', sourceFormat: 'clash' });
  });
});
