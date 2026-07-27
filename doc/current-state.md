# Current State

> New conversation entrypoint: `doc/handoff.md`. Read it first for project identity, user decisions, stale-plan corrections, and takeover order.

## Current behavior

- The React upload page accepts Clash YAML and Surge CONF up to 2 MB and detects the format from content.
- Conversion runs in the browser through a shared normalized model. It supports Trojan nodes, `select` groups, common domain/IP/GEOIP/process/final rules, and removes traffic/expiry information nodes from generated outputs.
- Clash input produces clean Surge and Quantumult X complete profiles.
- Surge input is preserved byte-for-byte for the Surge output. Portable nodes, policies, DNS, and local rules are rendered for Quantumult X; unsupported Surge-only sections and rule types are reported before publishing.
- `POST /api/publish` requires `ADMIN_TOKEN`, validates payload shape and size, computes SHA-256 digests, writes an immutable R2 version, then updates `current.json` last.
- `GET /api/status` requires `ADMIN_TOKEN` and returns current metadata plus fixed subscription URLs.
- `GET /sub/surge.conf?p=...` and `GET /sub/quanx.conf?p=...` share `SUBSCRIPTION_TOKEN`; missing or invalid values return `404`.
- Subscription responses stream R2 bodies, support `ETag`, disable shared caching, and opt out of indexing.

## Current decisions

- Cloudflare Worker is a storage and distribution boundary, not a conversion engine. This keeps large YAML parsing outside the Workers Free CPU budget.
- R2 is private and strongly consistent. Version artifacts are immutable; the mutable current pointer is written only after all artifacts succeed.
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
- `npm run deploy:dry-run`: Worker Static Assets and the `PROFILE_BUCKET` binding packaged successfully without publishing.
- Real-file read-only smoke conversion:
  - `westData2.yaml`: 61 usable proxies, 21 groups, 4232 rules, 32 QX-inapplicable process rules, 2 information nodes removed.
  - `WestData-expanded.conf`: 61 usable proxies, 21 groups, 9 portable local rules, 2 QX-inapplicable process rules, 2 information nodes removed; Surge-only remote rules and sections were reported.

Not yet performed:

- Production R2 bucket creation.
- Production secrets configuration.
- Cloudflare deployment.
- Post-deployment testing in Surge and Quantumult X.

## Deployment state

The project is configured for Worker Static Assets and an R2 bucket named `proxy-profile-service`. It has not been deployed. Production requires creating the bucket and setting `ADMIN_TOKEN` and `SUBSCRIPTION_TOKEN` through Wrangler.

## Known constraints

- Only Trojan nodes and `select` policy groups are accepted. Unsupported critical protocols or policy types block publishing instead of being silently dropped.
- Surge Script, MITM, Rewrite, Map Local, SSID settings, and remote `RULE-SET` entries are not converted to QX.
- R2 retains previous immutable versions. There is no cleanup job because expected personal update volume is low; add retention only if storage growth becomes material.
