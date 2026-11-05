# Implementation plan

**Current roadmap:** use [STUDIO-ROADMAP.md](STUDIO-ROADMAP.md) and the [accepted dual-mode brief](STUDIO-PRODUCT-BRIEF.md). The phase numbers below are historical website-editor milestones, preserved for context. New Phase 1 is the editorial entry/dashboard/shell; new Phase 2 is the Design canvas. See [Phase 1 evidence](PHASE-1.md).

The accepted product is a public visual, no-code builder whose users preview and download independent full-stack websites. We do not host or deploy user websites.

Confirmed stack: React/TypeScript/Vite/Tailwind/Puck/Zod builder; browser-side generation; independent Next.js exports using each owner's Supabase and optional Brevo. Future Cloudflare/Supabase services support the builder only. No LLM is needed.

Ordered milestones:
0. Independent export proof: configurable business page, real contact persistence, owner admin login/inbox, isolated verification.
1. Editor foundation: canonical validated schema, component registry, page tree/nesting, responsive controls, undo/recovery.
2. First usable release: two complete designs, CMS for projects/services/articles, contact inbox, full export, code copying, owner deployment.
3. Public beta: Google/email login, workspace isolation, cloud saves, multiple projects, measured byte quotas, six templates, security review.
4. Production: twelve designs, search, accessibility/performance, migration/backup/restore verification.
5. Commerce sandbox: products/variants, atomic stock, carts/orders, shipping/tax, provider sandbox.
6. Live commerce: merchant countries and eligibility confirmed, owner credentials, independent payment/security review.
7. Library expansion: 100+ meaningful variations in major categories, functional verticals, optional effects/integrations.

Export-first acceptance: a fresh generated project runs with separate credentials and all builder access blocked. Preview simulation, build success, and live backend verification are different statuses.

Current stage: milestone 0 and the implemented editor-foundation slices have recorded verification. Phase 2 is partially implemented with Services, external-link Portfolio, and Articles CMS collections. The owner selected **Save draft, then Publish**: saving changes leaves the previous published snapshot visible until an explicit publication. The builder now uses schema version 7; supported older backups migrate without replacing existing page content. See [Services scope](SERVICES.md), [Articles scope](ARTICLES.md), and [exact verification evidence](PROGRESS.md).

The Services milestone has four archived passing export combinations. The current slice adds Articles CMS, four Articles designs, four shared footers, three static Services designs and three Text designs. The navigation/hero/button batch supplies 4/6/8 designs. Next within phase 2: two distinct complete website templates, component copying, and the beginner deployment journey on owner-controlled hosting. The current starters share the same overall page shell; portfolio selects its own collection. They still do not satisfy the two complete distinct-template milestone.

No arbitrary user code executes in the builder. Source may be changed after export; edited source is not imported back. Cloud limits must be based on measured bytes, not a one-project rule. Domain-only beta budget means finite free allowances and no automatic paid upgrade.

Each milestone documents working behavior, gaps, checks, and next requirements. Do not call milestone 0 complete before its isolated database/authentication test passes.

Confirmed layout decision: use column-width presets first, with separate mobile/tablet/desktop settings and explicit inheritance. Draggable dividers are a later enhancement. Shared headers and footers apply across every page.

The owner reiterated the long-term 100+ design requirement across component families, including buttons, navigation, heroes and other components, with selectable styles, themes and effects. Grow the catalog in tested batches using stable recipe identities and controlled structural variants. Color/shape/motion combinations alone must not be counted as 100 distinct designs. The initial nested-layout release includes four button designs and a small motion set, not the finished library.

The owner prioritizes visible design variety alongside functionality. The 100+ design target is tracked per component family in DESIGN-LIBRARY.md. Every following functional milestone should include a tested visual-library batch; phase 7 is sustained expansion, not the first time visual variety is delivered.

Future library requirement from the owner: provide open, readable, copyable component source and dependency instructions in the spirit of shadcn/ui's code-ownership model. Also add validated linked icon/symbol components for actions such as Home and Back. These are not part of the Articles/footer/common-section batch. Choose an icon license and keyboard/accessible-name rules before implementing them.
