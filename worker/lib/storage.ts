import type {
  ProfileSlot,
  ProfileSlots,
  ProfileDigests,
  PublishedProfileMetadata,
  PublishRequest,
  StatusResponse,
  SubscriptionUrls,
} from '../../shared/contracts/profile';

export const CURRENT_KEY = 'profile:current';
export const BACKUP_KEY = 'profile:backup';
const encoder = new TextEncoder();

const profileKey = (slot: ProfileSlot): string => (slot === 'primary' ? CURRENT_KEY : BACKUP_KEY);

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

export const readProfile = (store: KVNamespace, slot: ProfileSlot): Promise<StoredProfile | null> =>
  store.get<StoredProfile>(profileKey(slot), 'json');

export const writeProfile = (
  store: KVNamespace,
  slot: ProfileSlot,
  profile: StoredProfile,
): Promise<void> => store.put(profileKey(slot), JSON.stringify(profile));

export const readProfileMetadata = async (
  store: KVNamespace,
  slot: ProfileSlot,
): Promise<PublishedProfileMetadata | null> => (await readProfile(store, slot))?.metadata ?? null;

export const readAllMetadata = async (
  store: KVNamespace,
): Promise<ProfileSlots<PublishedProfileMetadata | null>> => {
  const [primary, backup] = await Promise.all([
    readProfileMetadata(store, 'primary'),
    readProfileMetadata(store, 'backup'),
  ]);
  return { primary, backup };
};

export const subscriptionUrls = (
  requestUrl: string,
  token: string,
  slot: ProfileSlot,
): SubscriptionUrls => {
  const origin = new URL(requestUrl).origin;
  const query = new URLSearchParams({ p: token });
  const prefix = slot === 'primary' ? '/sub' : '/sub/backup';
  return {
    surge: `${origin}${prefix}/surge.conf?${query}`,
    quanx: `${origin}${prefix}/quanx.conf?${query}`,
  };
};

export const allSubscriptionUrls = (
  requestUrl: string,
  token: string,
): ProfileSlots<SubscriptionUrls> => ({
  primary: subscriptionUrls(requestUrl, token, 'primary'),
  backup: subscriptionUrls(requestUrl, token, 'backup'),
});

export const statusPayload = (
  requestUrl: string,
  token: string,
  profiles: ProfileSlots<PublishedProfileMetadata | null>,
): StatusResponse => ({ profiles, urls: allSubscriptionUrls(requestUrl, token) });
