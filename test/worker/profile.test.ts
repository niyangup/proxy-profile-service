import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProfileSlot, PublishRequest } from '../../shared/contracts/profile';
import { logWorkerError } from '../../worker/lib/http';
import { BACKUP_KEY, CURRENT_KEY } from '../../worker/lib/storage';

const ADMIN_TOKEN = 'local-admin-token-change-me';
const SUBSCRIPTION_TOKEN = 'local-subscription-token-change-me';
const basePayload = {
  sourceName: 'profile.yaml',
  sourceFormat: 'clash' as const,
  source: 'proxies: []',
  surge:
    '[General]\n\n[Proxy]\nDIRECT = direct\n\n[Proxy Group]\nFinal = select, DIRECT\n\n[Rule]\nFINAL,Final\n',
  quanx:
    '[general]\n\n[dns]\nserver = 119.29.29.29\n\n[policy]\nstatic = Final, direct\n\n[server_local]\ntrojan=example.com:443, password=test, over-tls=true, tag=Test\n\n[filter_local]\nfinal, Final\n',
  warnings: [],
  ignoredSections: [],
  stats: { proxies: 1, groups: 1, rules: 1, skippedRules: 0, removedInfoNodes: 0 },
} satisfies Omit<PublishRequest, 'slot'>;

const publish = (
  slot: ProfileSlot = 'primary',
  token = ADMIN_TOKEN,
  overrides: Partial<PublishRequest> = {},
) =>
  SELF.fetch('https://example.com/api/publish', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...basePayload, slot, ...overrides }),
  });

describe('profile worker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await Promise.all([
      env.PROFILE_STORE.delete(CURRENT_KEY),
      env.PROFILE_STORE.delete(BACKUP_KEY),
    ]);
  });

  it('rejects invalid management and subscription credentials', async () => {
    expect((await publish('primary', 'wrong')).status).toBe(401);
    expect((await SELF.fetch('https://example.com/api/status')).status).toBe(401);
    expect((await SELF.fetch('https://example.com/sub/surge.conf')).status).toBe(404);
    expect((await SELF.fetch('https://example.com/sub/backup/surge.conf?p=wrong')).status).toBe(
      404,
    );
  });

  it('keeps the existing fixed URLs for the primary slot', async () => {
    const response = await publish();
    expect(response.status).toBe(201);
    const result = (await response.json()) as {
      urls: { primary: { surge: string; quanx: string } };
    };
    expect(result.urls.primary).toEqual({
      surge: `https://example.com/sub/surge.conf?p=${SUBSCRIPTION_TOKEN}`,
      quanx: `https://example.com/sub/quanx.conf?p=${SUBSCRIPTION_TOKEN}`,
    });

    const surge = await SELF.fetch(result.urls.primary.surge);
    const quanx = await SELF.fetch(result.urls.primary.quanx);
    expect(surge.status).toBe(200);
    expect(await surge.text()).toBe(basePayload.surge);
    expect(await quanx.text()).toBe(basePayload.quanx);
    expect(surge.headers.get('Cache-Control')).toBe('private, no-store');

    const conditional = await SELF.fetch(result.urls.primary.surge, {
      headers: { 'If-None-Match': surge.headers.get('ETag') ?? '' },
    });
    expect(conditional.status).toBe(304);
  });

  it('publishes and serves the backup slot without replacing primary', async () => {
    await publish('primary');
    const response = await publish('backup', ADMIN_TOKEN, {
      sourceName: 'backup.yaml',
      surge: `${basePayload.surge}\n# backup`,
      quanx: `${basePayload.quanx}\n# backup`,
    });
    expect(response.status).toBe(201);
    const result = (await response.json()) as {
      publishedSlot: ProfileSlot;
      profiles: { primary: { sourceName: string }; backup: { sourceName: string } };
      urls: { backup: { surge: string; quanx: string } };
    };
    expect(result.publishedSlot).toBe('backup');
    expect(result.profiles.primary.sourceName).toBe('profile.yaml');
    expect(result.profiles.backup.sourceName).toBe('backup.yaml');
    expect(result.urls.backup).toEqual({
      surge: `https://example.com/sub/backup/surge.conf?p=${SUBSCRIPTION_TOKEN}`,
      quanx: `https://example.com/sub/backup/quanx.conf?p=${SUBSCRIPTION_TOKEN}`,
    });
    expect(await (await SELF.fetch(result.urls.backup.surge)).text()).toContain('# backup');
    expect(
      await (await SELF.fetch(`https://example.com/sub/surge.conf?p=${SUBSCRIPTION_TOKEN}`)).text(),
    ).toBe(basePayload.surge);
  });

  it('returns metadata for both slots to an authorized administrator', async () => {
    await Promise.all([
      publish('primary'),
      publish('backup', ADMIN_TOKEN, { sourceName: 'backup.yaml' }),
    ]);
    const response = await SELF.fetch('https://example.com/api/status', {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      profiles: {
        primary: { sourceName: string; sourceFormat: string };
        backup: { sourceName: string; sourceFormat: string };
      };
    };
    expect(result.profiles.primary).toMatchObject({
      sourceName: 'profile.yaml',
      sourceFormat: 'clash',
    });
    expect(result.profiles.backup).toMatchObject({
      sourceName: 'backup.yaml',
      sourceFormat: 'clash',
    });
  });

  it('rejects empty conversion statistics without replacing the current snapshot', async () => {
    await publish('primary');
    const response = await publish('primary', ADMIN_TOKEN, {
      stats: { proxies: 0, groups: 0, rules: 0, skippedRules: 0, removedInfoNodes: 0 },
    });

    expect(response.status).toBe(400);
    const current = await SELF.fetch(`https://example.com/sub/surge.conf?p=${SUBSCRIPTION_TOKEN}`);
    expect(await current.text()).toBe(basePayload.surge);
  });

  it('logs only structured, non-sensitive context for Worker failures', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logWorkerError(
      'publish',
      new Request('https://example.com/api/publish?p=must-not-log'),
      new Error('sensitive-detail'),
    );

    expect(consoleError).toHaveBeenCalledOnce();
    const logged = String(consoleError.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toEqual({
      event: 'worker_request_error',
      operation: 'publish',
      method: 'GET',
      path: '/api/publish',
      errorType: 'Error',
    });
    expect(logged).not.toContain('must-not-log');
    expect(logged).not.toContain('sensitive-detail');
  });
});
