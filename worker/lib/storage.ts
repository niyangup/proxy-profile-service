import type {
  ProfileDigests,
  PublishedProfileMetadata,
  PublishRequest,
  StatusResponse,
  SubscriptionUrls,
} from '../../shared/contracts/profile';

export const CURRENT_KEY = 'current.json';
const encoder = new TextEncoder();

export const objectKeys = (version: string, sourceFormat: PublishRequest['sourceFormat']) => ({
  source: `versions/${version}/source.${sourceFormat === 'clash' ? 'yaml' : 'conf'}`,
  surge: `versions/${version}/surge.conf`,
  quanx: `versions/${version}/quanx.conf`,
  metadata: `versions/${version}/metadata.json`,
});

const bytesToHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const sha256 = async (content: string): Promise<string> =>
  bytesToHex(await crypto.subtle.digest('SHA-256', encoder.encode(content)));

export const createDigests = async (request: PublishRequest): Promise<ProfileDigests> => {
  const [source, surge, quanx] = await Promise.all([
    sha256(request.source),
    sha256(request.surge),
    sha256(request.quanx),
  ]);
  return { source, surge, quanx };
};

export const readCurrentMetadata = async (
  bucket: R2Bucket,
): Promise<PublishedProfileMetadata | null> => {
  const object = await bucket.get(CURRENT_KEY);
  if (!object) return null;
  return object.json<PublishedProfileMetadata>();
};

export const subscriptionUrls = (requestUrl: string, token: string): SubscriptionUrls => {
  const origin = new URL(requestUrl).origin;
  const query = new URLSearchParams({ p: token });
  return {
    surge: `${origin}/sub/surge.conf?${query}`,
    quanx: `${origin}/sub/quanx.conf?${query}`,
  };
};

export const statusPayload = (
  requestUrl: string,
  token: string,
  current: PublishedProfileMetadata | null,
): StatusResponse => ({ current, urls: subscriptionUrls(requestUrl, token) });
