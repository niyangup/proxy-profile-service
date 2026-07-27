const encoder = new TextEncoder();

export const secureEqual = (actual: string | null | undefined, expected: string): boolean => {
  if (!actual) return false;
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);
  return (
    actualBytes.byteLength === expectedBytes.byteLength &&
    crypto.subtle.timingSafeEqual(actualBytes, expectedBytes)
  );
};

export const hasAdminAccess = (request: Request, env: Env): boolean => {
  const authorization = request.headers.get('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  return secureEqual(token, env.ADMIN_TOKEN);
};

export const hasSubscriptionAccess = (url: URL, env: Env): boolean =>
  secureEqual(url.searchParams.get('p'), env.SUBSCRIPTION_TOKEN);
