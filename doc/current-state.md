# Current State

> New conversation entrypoint: `doc/handoff.md`. Read it first for project identity, user decisions, stale-plan corrections, and takeover order.

## Current behavior

- The React page exposes independent primary and backup upload slots. Each accepts one Clash YAML or Surge CONF up to 2 MB and detects the format from content.
- Conversion runs in the browser through a shared normalized model. It supports Trojan nodes, `select` groups, common domain/IP/GEOIP/process/final rules, and removes traffic/expiry information nodes from generated outputs.
- Empty profiles, profiles without a final rule, and field values that cannot be serialized safely to Surge/QX are rejected before publication. QX preserves `no-resolve` on IP/GEOIP rules and reports unsupported rule options.
- Each upload slot ignores stale asynchronous file reads, so selecting a second file cannot be overwritten by a slower first read.
- Clash input produces clean Surge and Quantumult X complete profiles.
- Surge input is preserved byte-for-byte for the Surge output. Portable nodes, policies, DNS, and local rules are rendered for Quantumult X; unsupported Surge-only sections and rule types are reported before publishing.
- `POST /api/publish` accepts a `primary` or `backup` slot, validates management access and payload shape/size, computes SHA-256 digests, and replaces only that slot's complete KV snapshot.
- `GET /api/status` returns metadata and fixed URLs for both slots to an authenticated manager.
- The original `/sub/surge.conf?p=...` and `/sub/quanx.conf?p=...` remain primary. Backup uses `/sub/backup/surge.conf?p=...` and `/sub/backup/quanx.conf?p=...`. All four share `SUBSCRIPTION_TOKEN`; missing or invalid values return `404`.
- Subscription responses read the selected output from the current KV snapshot, use its SHA-256 digest as `ETag`, disable shared caching, and opt out of indexing.
- Unexpected Worker failures emit minimal structured logs containing only the operation, method, pathname, and error type; query strings, credentials, profile content, and raw error messages are excluded.

## Current decisions

- Cloudflare Worker is a storage and distribution boundary, not a conversion engine. This keeps large YAML parsing outside the Workers Free CPU budget.
- Workers KV is used because it is included in the Workers Free plan. One complete key per slot prevents split-version reads; because KV is eventually consistent, another region may briefly receive the previous complete version of the updated slot.
- The browser management UI asks for `ADMIN_TOKEN`, keeps it only in React memory, and sends it as a Bearer credential for status and publication requests.
- Development and Cloudflare Workers Builds are pinned to Node.js `24.12.0` through `.nvmrc` and the exact root package engine declaration, matching the local environment.
- Local Node.js uses npm `11.6.2`, while the current Workers Builds image intentionally performs automatic dependency installation with npm `10.9.2`. The lockfile is generated with complete cross-platform optional-dependency metadata and is validated with both versions.
- Query parameter `p` should use a high-entropy token. The current production secrets were explicitly supplied by the user as identical low-entropy values; this is a known security exception and should be replaced before sharing the service URL or subscription links.
- For the current WestData files, Clash YAML is the preferred input. It contains 4232 expanded rules; Surge CONF contains mostly remote Surge `RULE-SET` references that cannot safely be reused as QX local rules.
- Every AI conversation must end with a documentation state check. Any changed project fact must be reflected in `doc/handoff.md`, `doc/current-state.md`, and architecture documentation where applicable before the final response; stale conclusions are replaced rather than appended as a chronological log.

## Validation baseline

Performed locally:

- `npm run format`
- `npm run lint`
- `npm run typecheck`
- `npm test`: 10 frontend tests and 6 Worker tests passed, including conversion validation, QX option handling, file-read race protection, independent primary/backup publication, empty-snapshot rejection, safe error logging, and preservation of the original primary URLs.
- `npm run build`: formatting, lint, type checking, Worker bundle, and client bundle passed.
- `npm run deploy:dry-run`: the Bearer-authenticated Worker bundle, Static Assets, and existing `PROFILE_STORE` binding packaged successfully without publishing.
- npm `10.9.2` completed a real clean install, and npm `11.6.2` accepted the same lockfile. This specifically covers the Workers Builds dependency-install path.
- The primary/backup version was deployed successfully with Wrangler. Production `/` references the new client assets, `/api/health` returns `200`, and unauthenticated `/api/status` returns `401`.
- Real-file read-only smoke conversion:
  - `westData2.yaml`: 61 usable proxies, 21 groups, 4232 rules, 32 QX-inapplicable process rules, 2 information nodes removed.
  - `WestData-expanded.conf`: 61 usable proxies, 21 groups, 9 portable local rules, 2 QX-inapplicable process rules, 2 information nodes removed; Surge-only remote rules and sections were reported.

Not yet performed:

- Publishing the first real primary and backup profiles to production.
- Post-deployment testing in Surge and Quantumult X.

## Deployment state

Production is running the primary/backup version at `https://proxy-profile-service.niyangup.workers.dev` using the pinned `proxy-profile-service-profile-store` KV namespace. Version `d7511cb4-cf7b-4105-b2c9-3a8043ad913b` was deployed directly with Wrangler after the Git-connected Workers Build for commit `9b5ab49` failed without exposing its detailed log through GitHub. A later Git build failed during npm 10.9.2 installation because npm 11 had emitted incomplete metadata for optional wasm dependencies; the lockfile has now been regenerated and verified with both npm versions, but the resulting Git build has not yet been observed. `ADMIN_TOKEN` and `SUBSCRIPTION_TOKEN` are present and are the only required production Secrets. No R2 or R2 billing setup is required.

## Known constraints

- Only Trojan nodes and `select` policy groups are accepted. Unsupported critical protocols or policy types block publishing instead of being silently dropped.
- Names containing commas, equals signs, or line breaks and serialized values containing commas or line breaks are rejected because the supported target formats cannot represent them safely.
- Surge Script, MITM, Rewrite, Map Local, SSID settings, and remote `RULE-SET` entries are not converted to QX.
- Only the latest KV snapshot per slot is retained; publishing primary or backup replaces only that slot.
- The two production credentials are currently identical and low entropy by explicit user choice. This weakens both management and subscription protection; rotate them to different cryptographically random values before broader use.
