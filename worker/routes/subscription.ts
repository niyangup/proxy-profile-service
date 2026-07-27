import { hasSubscriptionAccess } from '../lib/auth';
import { readCurrentProfile } from '../lib/storage';

const notFound = (): Response => new Response('Not Found', { status: 404 });

export const handleSubscription = async (
  request: Request,
  env: Env,
  target: 'surge' | 'quanx',
): Promise<Response> => {
  const url = new URL(request.url);
  if (!hasSubscriptionAccess(url, env)) return notFound();
  const current = await readCurrentProfile(env.PROFILE_STORE);
  if (!current) return notFound();

  const etag = `"${current.metadata.digests[target]}"`;
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(current[target], {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `inline; filename="${target}.conf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      ETag: etag,
    },
  });
};
