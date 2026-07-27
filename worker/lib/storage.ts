import type {
  ProfileDigests,
  PublishedProfileMetadata,
  PublishRequest,
  StatusResponse,
  SubscriptionUrls,
} from '../../shared/contracts/profile';

export const CURRENT_KEY = 'profile:current';
const encoder = new TextEncoder();

export interface StoredProfile {
  readonly metadata: PublishedProfileMetadata;
  readonly source: string;
  readonly surge: string;
  readonly quanx: string;
}

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

export const readCurrentProfile = (store: KVNamespace): Promise<StoredProfile | null> =>
  store.get<StoredProfile>(CURRENT_KEY, 'json');

export const writeCurrentProfile = (store: KVNamespace, profile: StoredProfile): Promise<void> =>
  store.put(CURRENT_KEY, JSON.stringify(profile));

export const readCurrentMetadata = async (
  store: KVNamespace,
): Promise<PublishedProfileMetadata | null> => (await readCurrentProfile(store))?.metadata ?? null;

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
