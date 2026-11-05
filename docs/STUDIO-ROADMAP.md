# APL Studio delivery roadmap

This is the current roadmap accepted on 1 October 2026. It supersedes the old website-editor milestone numbers retained in PLAN.md and historical PROGRESS.md entries. The owner's full planning brief is preserved in STUDIO-PRODUCT-BRIEF.md.

APL has two connected modes: a freeform Design document and a semantic Website document. Design-to-website conversion is guided and explicit. Website exports are independent Next.js projects with owner-controlled services. Local editing/export requires no account or AI API key. Business and portfolio sites come first; the visual direction is an editorial studio.

| Phase | Deliverable | Current status |
|---|---|---|
| 0 | Preserve source/projects, baseline screenshots and checks, define document migration | Source snapshot and patches, before screenshots, v7 preservation tests, separate browser recovery snapshot, downloadable workspace backups, document contract |
| 1 | Editorial entry experience, saved-project dashboard, editor shell, complete interactive examples, onboarding | Implemented; verification evidence recorded in PHASE-1.md |
| 2 | Artboards, frames/layers, shapes/text/images, transforms, snapping, history, recovery, reusable styles, APL/PNG/PDF design downloads | Completed and verified 3 October 2026. See PHASE-2.md |
| 3 | Guided design-to-code proof, responsive mapping, links/contact binding, warnings and comparison | Completed and verified 3 October 2026. See PHASE-3.md |
| 4 | Useful dual-mode release, multi-page business/portfolio, shared/reusable components, content bindings, code copying and beginner deployment | Implemented locally; final acceptance and owner-host deployment gate recorded in PHASE-4.md |
| 5 | Cloud Google/email accounts, multiple projects, assets, versions, ownership/conflicts, measured quotas, six templates | Planned |
| 6 | Twelve complete templates, broader design systems, accessibility/performance, migrations/restore and owner-host hardening | Planned |
| 7 | Commerce catalog/cart/inventory/orders/admin, shipping/tax, sandbox payments, eligible owner live-payment setup | Planned |
| 8 | Broader site types, richer drawing/motion/collaboration, tested library expansion toward 100+ meaningful choices per major family | Planned |

Deliver one phase at a time. Record what works, what remains incomplete, exact checks, and a usable demonstration. Generated ZIPs retain the verification-required label: passing evidence applies to the exact artifact, not every future edit. Do not call a design mockup a functional backend. Do not call color/motion combinations distinct library designs. Do not promise production readiness or full Figma parity based on local builder tests.

At the Phase 2 checkpoint, the contract used a v8 envelope around the preserved v7 Website and a separate version 1 Design document. Canvas editing, visual exports, dual-document preservation and independent static source were verified; exact historical evidence and limitations are recorded in PHASE-2.md.

Phase 3 uses Studio9 with Website8 and unchanged Design1. Confirmed responsive mapping creates native headings, paragraphs, images, buttons and an optional working contact form. Compact connection records support explicit comparison and updates without replacing unrelated content. All 46 browser journeys, 213 unit checks and the production build passed; the exact UI-downloaded website passed 26 isolated runtime checks including the converted form's database persistence and independent admin inbox. See PHASE-3.md for hashes, migration/recovery behavior and limitations. Phase 4 is next. Vector/path editing, multiplayer, commerce and cloud credentials remain later work.
