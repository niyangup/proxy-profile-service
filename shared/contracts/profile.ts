export type PublishedSourceFormat = 'clash' | 'surge';
export type ProfileSlot = 'primary' | 'backup';

export interface ProfileSlots<T> {
  readonly primary: T;
  readonly backup: T;
}

export interface PublishStats {
  readonly proxies: number;
  readonly groups: number;
  readonly rules: number;
  readonly skippedRules: number;
  readonly removedInfoNodes: number;
}

export interface PublishRequest {
  readonly slot: ProfileSlot;
  readonly sourceName: string;
  readonly sourceFormat: PublishedSourceFormat;
  readonly source: string;
  readonly surge: string;
  readonly quanx: string;
  readonly warnings: readonly string[];
  readonly ignoredSections: readonly string[];
  readonly stats: PublishStats;
}

export interface ProfileDigests {
  readonly source: string;
  readonly surge: string;
  readonly quanx: string;
}

export interface PublishedProfileMetadata {
  readonly version: string;
  readonly sourceName: string;
  readonly sourceFormat: PublishedSourceFormat;
  readonly publishedAt: string;
  readonly warnings: readonly string[];
  readonly ignoredSections: readonly string[];
  readonly stats: PublishStats;
  readonly digests: ProfileDigests;
}

export interface SubscriptionUrls {
  readonly surge: string;
  readonly quanx: string;
}

export interface PublishResponse {
  readonly publishedSlot: ProfileSlot;
  readonly metadata: PublishedProfileMetadata;
  readonly profiles: ProfileSlots<PublishedProfileMetadata | null>;
  readonly urls: ProfileSlots<SubscriptionUrls>;
}

export interface StatusResponse {
  readonly profiles: ProfileSlots<PublishedProfileMetadata | null>;
  readonly urls: ProfileSlots<SubscriptionUrls>;
}

export interface ApiErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}
