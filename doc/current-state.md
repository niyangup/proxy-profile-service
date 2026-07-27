# Current State

> New conversation entrypoint: `doc/handoff.md`. Read it first for project identity, user decisions, stale-plan corrections, and takeover order.

## Current behavior

- The React upload page accepts Clash YAML and Surge CONF up to 2 MB and detects the format from content.
- Conversion runs in the browser through a shared normalized model. It supports Trojan nodes, `select` groups, common domain/IP/GEOIP/process/final rules, and removes traffic/expiry information nodes from generated outputs.
- Clash input produces clean Surge and Quantumult X complete profiles.
- Surge input is preserved byte-for-byte for the Surge output. Portable nodes, policies, DNS, and local rules are rendered for Quantumult X; unsupported Surge-only sections and rule types are reported before publishing.
- `POST /api/publish` requires `ADMIN_TOKEN`, validates payload shape and size, computes SHA-256 digests, and replaces one complete KV snapshot.
- `GET /api/status` requires `ADMIN_TOKEN` and returns current metadata plus fixed subscription URLs.
- `GET /sub/surge.conf?p=...` and `GET /sub/quanx.conf?p=...` share `SUBSCRIPTION_TOKEN`; missing or invalid values return `404`.
- Subscription responses read the selected output from the current KV snapshot, use its SHA-256 digest as `ETag`, disable shared caching, and opt out of indexing.

## Current decisions

- Cloudflare Worker is a storage and distribution boundary, not a conversion engine. This keeps large YAML parsing outside the Workers Free CPU budget.
- Workers KV is used because it is included in the Workers Free plan. A single-key snapshot prevents split-version reads; because KV is eventually consistent, another region may briefly receive the previous complete snapshot after publication.
- Management and subscription credentials are separate Workers Secrets. The browser does not persist the management token.
- Query parameter `p` is a high-entropy token, not a short password. Surge and QX intentionally share one subscription token for simpler personal use.
- For the current WestData files, Clash YAML is the preferred input. It contains 4232 expanded rules; Surge CONF contains mostly remote Surge `RULE-SET` references that cannot safely be reused as QX local rules.
- Every AI conversation must end with a documentation state check. Any changed project fact must be reflected in `doc/handoff.md`, `doc/current-state.md`, and architecture documentation where applicable before the final response; stale conclusions are replaced rather than appended as a chronological log.

## Validation baseline

Performed locally:

- `npm run format`
- `npm run lint`
- `npm run typecheck`
- `npm test`: 5 frontend tests and 3 Worker tests passed.
- `npm run build`: formatting, lint, type checking, Worker bundle, and client bundle passed.
- `npm run deploy:dry-run`: Worker Static Assets and the `PROFILE_STORE` KV binding packaged successfully without publishing.
- Real-file read-only smoke conversion:
  - `westData2.yaml`: 61 usable proxies, 21 groups, 4232 rules, 32 QX-inapplicable process rules, 2 information nodes removed.
  - `WestData-expanded.conf`: 61 usable proxies, 21 groups, 9 portable local rules, 2 QX-inapplicable process rules, 2 information nodes removed; Surge-only remote rules and sections were reported.

Not yet performed:

- Production secrets configuration.
- Successful deployment of the KV-backed Worker.
- Post-deployment testing in Surge and Quantumult X.

## Deployment state

Commit `10ea3dc` switched production from R2 to Workers KV and was pushed to GitHub `main`. Cloudflare automatically created the free namespace `proxy-profile-service-profile-store`. Build `554b0793-171a-4a70-a8cf-8e4012f5b625` did not deploy because the Worker's Secret list is still empty; `ADMIN_TOKEN` and `SUBSCRIPTION_TOKEN` must be added before retrying. No R2 or R2 billing setup is required.

## Known constraints

- Only Trojan nodes and `select` policy groups are accepted. Unsupported critical protocols or policy types block publishing instead of being silently dropped.
- Surge Script, MITM, Rewrite, Map Local, SSID settings, and remote `RULE-SET` entries are not converted to QX.
- Only the latest KV snapshot is retained; publishing replaces the previous stored configuration.
