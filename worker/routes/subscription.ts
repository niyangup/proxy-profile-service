import { hasSubscriptionAccess } from '../lib/auth';
import { objectKeys, readCurrentMetadata } from '../lib/storage';

const notFound = (): Response => new Response('Not Found', { status: 404 });

export const handleSubscription = async (
  request: Request,
  env: Env,
  target: 'surge' | 'quanx',
): Promise<Response> => {
  const url = new URL(request.url);
  if (!hasSubscriptionAccess(url, env)) return notFound();
  const current = await readCurrentMetadata(env.PROFILE_BUCKET);
  if (!current) return notFound();

  const keys = objectKeys(current.version, current.sourceFormat);
  const object = await env.PROFILE_BUCKET.get(keys[target]);
  if (!object) return notFound();
  if (request.headers.get('If-None-Match') === object.httpEtag) {
    return new Response(null, { status: 304, headers: { ETag: object.httpEtag } });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `inline; filename="${target}.conf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      ETag: object.httpEtag,
    },
  });
};
