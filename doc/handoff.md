# AI Handoff

## Project identity

Working directory:

```text
/Users/niyangup/WorkSpace/WebStormProjects/proxy-profile-service
```

The current target is `Quantumult X Resource Parser`. All earlier upload UI, primary/backup slots, Worker APIs, Workers KV snapshots, fixed subscription URLs, Secrets, and management authentication have been deliberately removed. Do not restore them unless the user explicitly changes direction.

## User workflow

1. Surge uses the supplier's native CONF directly.
2. Quantumult X configures the public Cloudflare URL ending in `/resource-parser.js` as `resource_parser_url`.
3. Quantumult X refreshes a supplier Clash YAML or Surge CONF and performs conversion locally.

The parser returns node lines only. It does not attempt to translate policy groups, rules, DNS, MITM, Rewrite, or Script sections.

## Implementation map

- `src/model.ts`: normalized proxy node types and conversion result.
- `src/parse-clash.ts`: bounded YAML parsing and Clash proxy adaptation.
- `src/parse-surge.ts`: manual Surge `[Proxy]` scanning and adaptation.
- `src/render.ts`: safe Quantumult X serialization.
- `src/index.ts`: format detection, limits, filtering, warnings, and conversion orchestration.
- `src/resource-parser.ts`: QX global runtime integration.
- `scripts/build.mjs`: browser IIFE bundle and static asset assembly.
- `public/`: static landing page and response headers.
- `test/`: protocol, safety, limit, and bundled-runtime coverage.

The implementation is original and MIT licensed. Do not copy code from KOP-XIAO's repository because it has no declared license. The `yaml` dependency is ISC licensed and documented in `THIRD_PARTY_NOTICES.md`.

## Sensitive real-file evidence

Real inputs are read-only and must never be printed, copied into fixtures, or persisted as converted output.

- `/Users/niyangup/Downloads/westData2.yaml`: the built parser converts 61 usable Trojan nodes and every output line retains `tls-host`. Two information nodes are filtered.
- `/Users/niyangup/Downloads/tag1.yaml`: the built parser converts 334 Shadowsocks nodes and every output line retains HTTP obfs and obfs host.

Only these aggregate facts may be repeated.

## Cloudflare boundary

`wrangler.jsonc` defines a Static Assets-only project named `quantumultx-resource-parser`. It has no Worker `main`, bindings, or secrets. The expected Git build configuration is:

```text
Build command: npm run build
Deploy command: npx wrangler deploy
```

Do not delete the old production Worker or deploy the replacement unless the user explicitly authorizes that external action. The user stated they will remove the old Cloudflare project themselves.

## Current status

The old application has been replaced by the parser, tests, static assets, license files, and current documentation. Empty legacy source directories were also removed. The reduced lockfile was generated without `node_modules` and passes real clean installs with npm 10.9.2 and npm 11.6.2. Parser/runtime tests and both aggregate real-file smoke tests pass.

The final Wrangler dry run executed the complete check pipeline, passed all 14 tests, packaged only three static assets, reported no bindings, and did not publish.

## Next steps

1. Let the Git-connected Cloudflare project build with `npm run build` and deploy with `npx wrangler deploy`, or deploy explicitly only if the user requests it.
2. Configure the resulting HTTPS `/resource-parser.js` URL in Quantumult X.
3. Validate the real supplier URL inside Quantumult X. If a future protocol is skipped, add it only after confirming current QX syntax and add a focused test.

## Documentation maintenance

When behavior, dependencies, deployment shape, validation status, or security boundaries change, update `doc/current-state.md`. When architecture or takeover instructions change, update this file and `doc/architecture/overview.md`. Record only checks that actually ran.
