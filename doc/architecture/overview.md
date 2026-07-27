# Architecture

## Responsibility boundaries

```mermaid
flowchart LR
  A[Clash YAML or Surge CONF] --> B[Browser input adapter]
  B --> C[Normalized profile]
  C --> D[Surge renderer]
  C --> E[Quantumult X renderer]
  D --> F[Authenticated publish API]
  E --> F
  F --> G[Immutable R2 version]
  G --> H[Current pointer]
  H --> I[Surge fixed URL]
  H --> J[QX fixed URL]
```

### Browser

- Owns untrusted text parsing, schema validation, format detection, normalization, rendering, and human-readable warnings.
- Holds the management token only in React component state.
- Publishes source text, both rendered outputs, conversion stats, and warnings as one JSON payload.

### Worker

- Owns authorization, request limits, structural output checks, digests, version publication, and subscription distribution.
- Does not parse YAML or reinterpret client conversion results.
- Keeps routing in `worker/index.ts`; HTTP, auth, validation, and R2 behavior are separate modules under `worker/lib/` and `worker/routes/`.

### R2

A published version uses these keys:

```text
versions/<version>/source.yaml|conf
versions/<version>/surge.conf
versions/<version>/quanx.conf
versions/<version>/metadata.json
current.json
```

All version objects are written first. `current.json` is the commit point. Readers resolve the pointer and then stream the matching immutable object.

## Conversion model

Both input formats map to:

- `ProxyNode`
- `PolicyGroup`
- `RoutingRule`
- `GeneralSettings`

Renderers depend only on that model. Adding another source format requires a new adapter; adding another target requires a new renderer. There are no direct Clash-to-QX or Surge-to-QX cross-module dependencies.

Surge input additionally retains `rawSource`. The Surge renderer returns it unchanged, preserving sections that do not belong in the normalized cross-platform model.

## Security model

- `ADMIN_TOKEN`: Bearer token for status and publication.
- `SUBSCRIPTION_TOKEN`: shared high-entropy value supplied as `p` on both fixed subscription URLs.
- Secret comparison uses `crypto.subtle.timingSafeEqual` after equal-length checks.
- Invalid subscription paths and tokens return the same `404` response.
- Static assets use a restrictive CSP and no third-party resources.
- Subscription responses use `Cache-Control: private, no-store` and `X-Robots-Tag`.

The query token remains a credential. Moving it from a path to `p` improves URL shape but does not replace entropy; short values such as `ny` are intentionally unsupported by deployment guidance.
