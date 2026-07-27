export const jsonResponse = (value: unknown, status = 200): Response =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

export const apiError = (code: string, message: string, status: number): Response =>
  jsonResponse({ error: { code, message } }, status);

export const readTextWithLimit = async (request: Request, maxBytes: number): Promise<string> => {
  const declaredLength = Number(request.headers.get('Content-Length') ?? 0);
  if (declaredLength > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    // Request streams are ordered and must be read sequentially.
    // oxlint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      void reader.cancel();
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
};
