# Repository instructions

## Start here

Before inspecting or changing this repository, read [`doc/PROJECT_STATUS.md`](doc/PROJECT_STATUS.md) in full. It is the authoritative handoff document for the current product state, verified behavior, architecture, deployment, known compatibility decisions, privacy constraints, and third-party research.

If the code and the status document disagree, verify the current code, Git history, and deployed behavior, then update the document as part of the same change.

## Project scope

This repository builds a standalone Quantumult X resource-parser JavaScript file. Quantumult X supplies Clash YAML or Surge CONF through `$resource.content`; the parser returns native Quantumult X server lines through `$done({ content })`.

The repository is not a Cloudflare Worker application. Do not recreate the retired upload UI, backend, Access, KV, R2, secrets, or admin-token system unless the user explicitly changes the product direction.

The public parser URL is:

```text
https://niyangup.github.io/proxy-profile-service/resource-parser.js
```

## Quantumult X compatibility requirements

- Follow the official resource-parser contract shown in <https://github.com/crossutility/Quantumult-X/blob/master/resource-parser.js>.
- Return native node text with `$done({ content: result.content })`.
- Keep the generated parser as a top-level script.
- Keep esbuild configured without an IIFE or strict-mode prologue. The current intentional setting is `format: 'esm'` with an entry point that has no exports.
- Do not reintroduce runtime Base64 encoding, `format: 'iife'`, `"use strict"`, or compatibility probe files without new official evidence and real-device verification.
- Do not assume Node.js or browser APIs exist in Quantumult X. Resource-parser scripts cannot perform their own HTTP requests or use persistent storage.
- Preserve the working `.js` output. The `.txt` file is only a compatibility copy.

The prior `Result type error` was resolved by aligning the output and generated script shape with the official API. File extension, GitHub Pages MIME type, the user's YAML, and Trojan fields were not the cause. Read the full incident record in `doc/PROJECT_STATUS.md` before changing the entry point or build format.

## Privacy and security

- Never commit subscription contents, node credentials, private URLs, tokens, or generated real-node output.
- `/Users/niyangup/Downloads/westData2.yaml` is private user data. It may only be read locally by this project's code for an explicitly relevant verification.
- Never upload private subscription data or pass it to third-party scripts, packages, websites, or services.
- When testing real input, report only safe aggregates such as node count, protocol count, result type, or boolean validation. Do not print servers, tags, passwords, UUIDs, or full node lines.
- Use synthetic fixtures with non-routable example hosts and fake credentials in committed tests.

## Development workflow

Use Node.js `24.12.0`, matching `.nvmrc` and `package.json#engines`.

Before making changes:

1. Run `git status --short` and preserve unrelated user changes.
2. Read the relevant source and tests.
3. Run `npm run check` when establishing a full baseline is practical.

Before handing off code changes, run:

```bash
npm run check
```

This covers formatting, linting, TypeScript, tests, and the production build. For documentation-only changes, at minimum run:

```bash
npm run format:check
git diff --check
```

Do not commit `dist/`; GitHub Actions builds it from source. Inspect the generated parser when changing runtime or build behavior: it must have the build-time banner, contain no module exports, execute at top level, and directly return string content through `$done`.

## Architecture and change rules

- `src/resource-parser.ts`: Quantumult X runtime entry point.
- `src/index.ts`: input detection and conversion orchestration.
- `src/parse-clash.ts`: lightweight Clash `proxies:` parser.
- `src/parse-surge.ts`: Surge `[Proxy]` parser.
- `src/render.ts`: Quantumult X node-line generation.
- `src/model.ts`: normalized proxy model.
- `scripts/build.mjs`: standalone `.js` and `.txt` build.
- `test/`: parser and runtime bundle coverage.

When adding a protocol or input feature, update the model, parser, renderer, and tests together. Verify that Quantumult X officially supports the target output. Unsupported individual nodes should be skipped with safe diagnostics; malformed input must not produce unsafe node lines.

The Clash parser is intentionally lightweight rather than a full YAML dependency. Prefer a focused extension with tests over adding a large runtime package. The prior third-party investigation found that `sub-store-convert` could work but produced an approximately 571 KB bundle, introduced runtime risk, and had unresolved upstream AGPL licensing considerations. Review `doc/PROJECT_STATUS.md` before introducing any conversion dependency.

## Deployment and documentation

Pushes to `main` run `.github/workflows/deploy.yml`, which checks the project, deploys GitHub Pages, and creates a GitHub Release containing `resource-parser.js` and `resource-parser.txt`.

After a runtime change:

1. Confirm the local full check passes.
2. Push the change and wait for GitHub Actions to succeed.
3. Verify the published file using a cache-busting query such as `?v=<commit>`.
4. Request one focused Quantumult X real-device test only when local verification cannot establish runtime compatibility.

Update `doc/PROJECT_STATUS.md` whenever a change materially affects the project's purpose, public URLs, supported formats or protocols, compatibility decisions, deployment, verified state, privacy constraints, or recommended next steps.
