# Current State

## Current behavior

- The repository is an independently implemented Quantumult X resource parser, not a profile upload or distribution service.
- The deployable output is static-only: `resource-parser.js` plus a small documentation page. There is no Worker entry point, API, storage binding, authentication flow, or server-side profile processing.
- The parser detects Clash YAML and Surge CONF from content, extracts proxy nodes, renders Quantumult X node lines, filters traffic/expiry information nodes, and reports skipped nodes through `$notify` when available.
- Supported node families are Shadowsocks, ShadowsocksR, Trojan, VMess, VLESS, HTTP, SOCKS5, and AnyTLS. Supported transports and extensions include simple-obfs, v2ray-plugin WebSocket, WebSocket/TLS, VLESS Reality, SNI, certificate verification flags, UDP relay, and fast open where representable.
- The parser accepts at most 5 MB and 5000 source nodes. Values containing commas or line breaks are not serialized into QX node lines.
- Clash policy groups/rules and non-proxy Surge sections are intentionally ignored.

## Current decisions

- Surge consumes the supplier's Surge CONF directly. Quantumult X consumes the supplier's Clash YAML or Surge CONF with this parser configured as `resource_parser_url`.
- Provider profiles remain at their original source; this project no longer stores copies or requires users to log in and upload files.
- KOP-XIAO's `resource-parser.js` was not copied. This implementation is original because that repository does not declare a license and its ordinary Trojan conversion omitted the SNI field required by the user's real profile.
- Static Assets are deployed through Cloudflare Workers with no `main` entry. No KV, R2, Access policy, `ADMIN_TOKEN`, or `SUBSCRIPTION_TOKEN` is required by the project.
- Node.js is fixed to `24.12.0`. The lockfile, rather than a requested global npm version, controls reproducible Cloudflare dependency installation.
- Production deployment and deletion/recreation of the old Cloudflare project remain user-controlled. This refactor must not deploy automatically from a local agent run.

## Validation baseline

Completed locally on 2026-07-27:

- A real clean install succeeded with Cloudflare's npm `10.9.2` and with local npm `11.6.2` using the same lockfile. The lock was generated without an existing `node_modules` directory so it retains cross-platform optional dependencies.
- `npm run deploy:dry-run` ran the complete format, lint, type, test, and build pipeline. All 14 parser/runtime tests passed.
- Wrangler packaged three static files, reported `No bindings found`, and exited without publishing. The standalone parser is about 109 KB.
- Read-only bundle smoke test against `westData2.yaml`: 61 usable Trojan nodes converted; all 61 retained `tls-host`; no secrets or converted output were printed or persisted.
- Read-only bundle smoke test against `tag1.yaml`: 334 Shadowsocks nodes converted; all 334 retained `obfs=http` and `obfs-host`; no secrets or converted output were printed or persisted.

## Deployment state

- The previously deployed `proxy-profile-service` upload/KV Worker may still exist in Cloudflare. The user plans to delete or replace it.
- The new static parser has not been deployed from this working tree.
- GitHub `origin` remains `niyangup/proxy-profile-service`; this repository is intentionally being reused instead of creating another one.

## Security constraints

- Real supplier YAML/CONF files, proxy hosts, credentials, SNI values, converted profiles, and prior production secrets must never enter Git, documentation, test fixtures, or command output.
- The bundled parser executes inside Quantumult X. Source profiles are neither uploaded to nor processed by Cloudflare.
- The public parser URL is expected to be public; it contains code only and no subscription data.
