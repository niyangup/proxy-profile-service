export type SourceFormat = 'clash' | 'surge';

export interface ProxyNode {
  readonly name: string;
  readonly type: 'trojan';
  readonly server: string;
  readonly port: number;
  readonly password: string;
  readonly sni?: string;
  readonly skipCertificateVerification: boolean;
  readonly udpRelay: boolean;
  readonly fastOpen: boolean;
}

export interface PolicyGroup {
  readonly name: string;
  readonly type: 'select';
  readonly members: readonly string[];
}

export type RuleType =
  | 'DOMAIN'
  | 'DOMAIN-SUFFIX'
  | 'DOMAIN-KEYWORD'
  | 'IP-CIDR'
  | 'IP-CIDR6'
  | 'GEOIP'
  | 'PROCESS-NAME'
  | 'MATCH'
  | 'FINAL';

export interface RoutingRule {
  readonly type: RuleType;
  readonly value?: string;
  readonly policy: string;
  readonly options: readonly string[];
}

export interface GeneralSettings {
  readonly dnsServers: readonly string[];
  readonly ipv6: boolean;
  readonly proxyTestUrl: string;
}

export interface NormalizedProfile {
  readonly sourceFormat: SourceFormat;
  readonly sourceName: string;
  readonly rawSource: string;
  readonly proxies: readonly ProxyNode[];
  readonly groups: readonly PolicyGroup[];
  readonly rules: readonly RoutingRule[];
  readonly general: GeneralSettings;
  readonly warnings: readonly string[];
  readonly ignoredSections: readonly string[];
}

export interface ConversionStats {
  readonly proxies: number;
  readonly groups: number;
  readonly rules: number;
  readonly skippedRules: number;
  readonly removedInfoNodes: number;
}

export interface ConvertedProfile {
  readonly sourceFormat: SourceFormat;
  readonly sourceName: string;
  readonly source: string;
  readonly surge: string;
  readonly quanx: string;
  readonly warnings: readonly string[];
  readonly ignoredSections: readonly string[];
  readonly stats: ConversionStats;
}

export class ConversionError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues[0] ?? '配置转换失败');
    this.name = 'ConversionError';
    this.issues = issues;
  }
}
