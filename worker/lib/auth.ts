const encoder = new TextEncoder();

export const secureEqual = async (
  actual: string | null | undefined,
  expected: string | null | undefined,
): Promise<boolean> => {
  if (!actual || !expected) return false;
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(actualHash, expectedHash);
};

export const hasAdminAccess = async (request: Request, env: Env): Promise<boolean> => {
  const authorization = request.headers.get('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  return secureEqual(token, env.ADMIN_TOKEN);
};

export const hasSubscriptionAccess = (url: URL, env: Env): Promise<boolean> =>
  secureEqual(url.searchParams.get('p'), env.SUBSCRIPTION_TOKEN);
