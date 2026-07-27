export type SourceFormat = 'clash' | 'surge';

export type ProxyType = 'ss' | 'ssr' | 'trojan' | 'vmess' | 'vless' | 'http' | 'socks5' | 'anytls';

export interface ProxyNode {
  readonly type: ProxyType;
  readonly name: string;
  readonly server: string;
  readonly port: number;
  readonly password?: string;
  readonly username?: string;
  readonly uuid?: string;
  readonly cipher?: string;
  readonly sni?: string;
  readonly skipCertificateVerification?: boolean;
  readonly udp?: boolean;
  readonly fastOpen?: boolean;
  readonly tls?: boolean;
  readonly network?: 'tcp' | 'ws' | 'http';
  readonly wsHost?: string;
  readonly wsPath?: string;
  readonly plugin?: 'obfs' | 'v2ray-plugin';
  readonly pluginMode?: 'http' | 'tls' | 'websocket';
  readonly pluginHost?: string;
  readonly pluginPath?: string;
  readonly pluginTls?: boolean;
  readonly ssrProtocol?: string;
  readonly ssrProtocolParam?: string;
  readonly ssrObfs?: string;
  readonly ssrObfsParam?: string;
  readonly alterId?: number;
  readonly flow?: string;
  readonly realityPublicKey?: string;
  readonly realityShortId?: string;
}

export interface ConversionResult {
  readonly content: string;
  readonly sourceFormat: SourceFormat;
  readonly sourceNodes: number;
  readonly convertedNodes: number;
  readonly skippedNodes: number;
  readonly warnings: readonly string[];
}

export class ResourceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceParseError';
  }
}
