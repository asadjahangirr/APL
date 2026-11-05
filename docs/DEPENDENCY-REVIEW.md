# Dependency patch review for Phase 4

The first clean export installation reported four affected packages: Next.js, Sharp, Zod and source-map-js. The builder's audit also reported Vite, Vitest and the Happy DOM dependency used by its editor's server HTML tooling. The original audit JSON is retained under `.artifacts/phase-4/`.

## Chosen patches

- Export Next.js: 16.3.6 to 16.4.3. The maintainer's [typed-array cache advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) identifies affected releases through 16.4.0 and recommends upgrading. The audit also listed other Next.js advisories. The export does not use arbitrary user scripts or enable Cache Components, but it still receives the patched framework.
- Export Sharp: 0.35.4 to [0.35.5](https://github.com/lovell/sharp/releases/tag/v0.35.5). Raster-only input validation stays in place; a dependency update does not replace it.
- Builder and export Zod: 4.6.5 to [4.6.7](https://github.com/colinhacks/zod/releases/tag/v4.6.7). Existing bounded payloads, structural schemas, and migration fixtures remain in use.
- Builder Vite: 8.3.1 to [8.3.5](https://github.com/vitejs/vite/releases/tag/v8.3.5); Vitest: 5.0.2 to [5.0.5](https://github.com/vitest-dev/vitest/releases/tag/v5.0.5).
- source-map-js: update the compatible transitive lockfile resolution to an unaffected release. No additional runtime dependency is added just to pin it.
- Builder Happy DOM: override the editor HTML tooling's old-major peer requirement with [21.0.4](https://github.com/capricorn86/happy-dom/releases/tag/v21.0.4), the patched release identified by the [maintainer advisory](https://github.com/capricorn86/happy-dom/security/advisories/GHSA-834v-8h66-3h79).

The Happy DOM override crosses the old peer major and therefore needs explicit compatibility coverage. `tests/dependency-compat.test.ts` exercises the actual Tiptap server HTML serializer/parser with schema-controlled text. The existing editor/browser journeys exercise the browser branch. The installed Tiptap package selects its browser implementation for browser imports and its Happy DOM implementation for Node/server imports. APL has no public server endpoint that evaluates submitted HTML or scripts through Happy DOM. Exports contain neither Puck nor Tiptap/Happy DOM.

Keep the override visible in package.json. Revisit it when the editor's upstream dependency range accepts a patched release, then remove it only after the same checks pass.

## Evidence and limits

Both the builder install and the updated export-template lockfile reported zero registry advisories after these changes. Final audit JSON and compatibility checks are retained with the acceptance artifacts. The verifier installs only Chromium's headless shell, matching its actual browser launch and avoiding an unused full-browser download; this follows the [official Playwright installation guidance](https://playwright.dev/docs/browsers#chromium-headless-shell).

Acceptance exports generated with version 0.9.1 use the patched template and regenerated dependency lockfile. Earlier 0.9.0 downloads and any reports apply only to their older source hashes; they are not final acceptance for this batch.

Audit results, clean builds, unit/browser checks and exact isolated export reports are recorded in PHASE-4.md after they finish. A zero advisory count, where observed, describes the registry audit at that time; it is not a security certification. Independent authorization, tenant-isolation, upload, abuse and recovery review remain required before a public production release.
