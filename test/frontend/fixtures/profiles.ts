export const clashFixture = `
port: 7890
ipv6: false
proxies:
  - name: "Traffic: 1 GB / 100 GB"
    type: trojan
    server: info.example.com
    port: 443
    password: info-password
    sni: edge.example.com
    skip-cert-verify: true
    udp: true
  - name: HK-01
    type: trojan
    server: hk.example.com
    port: 443
    password: test-password
    sni: edge.example.com
    skip-cert-verify: true
    udp: true
proxy-groups:
  - name: Proxies
    type: select
    proxies:
      - "Traffic: 1 GB / 100 GB"
      - HK-01
  - name: Final
    type: select
    proxies:
      - Proxies
      - DIRECT
rules:
  - DOMAIN-SUFFIX,example.com,Proxies
  - IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
  - PROCESS-NAME,curl,DIRECT
  - MATCH,Final
`;

export const surgeFixture = `[General]
dns-server = 119.29.29.29, 223.5.5.5
proxy-test-url = http://www.gstatic.com/generate_204

[Proxy]
DIRECT = direct
Expire: 2099-01-01 = trojan, info.example.com, 443, password=info-password, sni=edge.example.com, skip-cert-verify=true, tfo=true, udp-relay=true
HK-01 = trojan, hk.example.com, 443, password=test-password, sni=edge.example.com, skip-cert-verify=true, tfo=true, udp-relay=true

[Proxy Group]
Proxies = select, Expire: 2099-01-01, HK-01
Final = select, Proxies, DIRECT

[Rule]
DOMAIN-SUFFIX,example.com,Proxies
PROCESS-NAME,curl,DIRECT
FINAL,Final

[MITM]
enable = true
hostname = example.com

[Script]
http-response example requires-body=true, script-path=https://example.com/script.js
`;
