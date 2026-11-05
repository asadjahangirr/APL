# APL Studio: design freely, then build a working website

## Product decision and feasibility

**Yes, this product is possible without an external AI API key.** APL can let someone create a visual design, turn it into a responsive website through a guided process, connect supported features, and download independent full-stack code. The important limit is that an arbitrary drawing cannot reveal what a button does, where form data goes, or how a layout should rearrange on mobile. The user must confirm those rules before code export.

We will build **two connected modes**, as you selected:

| Mode | What the user can do | Download |
|---|---|---|
| **Design** | Arrange frames, layers, text, images, shapes, and reusable visual components freely | Editable APL project, PNG artboards, and a visual PDF |
| **Build** | Refine responsive pages, connect buttons and content to real features, test interactions | Readable Next.js frontend, selected backend modules, database migrations, admin screens, assets, and setup guides |

**Convert to website** will suggest a structure for a selected design. The user confirms layout, mobile behavior, accessibility details, and feature connections. It will report anything it cannot convert faithfully. Complex decorative artwork may remain an image; meaningful text and controls must remain real website elements. Conversion will not silently claim that a visual mockup is a working feature.

This matches the distinction visible in Figma’s own tools: freeform [frames](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) support visual composition, while responsive websites rely on [auto layout, breakpoints](https://help.figma.com/hc/en-us/articles/33257143505175-Tips-for-creating-a-responsive-webpage-in-Figma-Sites), and explicit [positioning rules](https://help.figma.com/hc/en-us/articles/31242774629655-Position-elements-in-a-webpage). Full Figma feature parity, including advanced vector editing and multiplayer collaboration, is a much larger, multi-year goal.

## What exists and what changes

The actual application is in [C:\Users\ASAD\Projects\APL](</C:/Users/ASAD/Projects/APL/README.md>); the currently supplied E: workspace is empty. Implementation must target **C:** as the writable project folder. I made no code changes in this planning pass.

The current app already has multi-page projects, structured editing, responsive settings, themes, several component designs, preview, and independent Next.js exports for contact forms and selected CMS modules. The [progress record](</C:/Users/ASAD/Projects/APL/docs/PROGRESS.md>) includes isolated backend checks. It is still a section editor, not the canvas you described. The two starters share an overall layout, and the [design library](</C:/Users/ASAD/Projects/APL/docs/DESIGN-LIBRARY.md>) is small relative to your 100+ goal. Existing project data, exports, and uncommitted work must be preserved.

The next architecture will use:

- A **Design document** containing artboards, frames, layers, coordinates, visual properties, assets, and reusable instances.
- A separate **Website document** containing pages, semantic components, responsive layout rules, links, content bindings, and selected functional modules.
- Shared theme tokens, images, typography, and component recipe IDs so the two modes feel connected.
- A recorded conversion link from a design frame to a website section. Conversion copies the design into Build mode; later design edits show a comparison and require an explicit update, so they cannot overwrite website work unexpectedly.
- Versioned validation and migration. Existing version-7 projects open with their website pages intact and an empty Design canvas. Backups remain importable.

For Design mode, use a browser canvas based on React Konva for selection, transforms, and image export; its current React package supports the repository’s React version and is MIT licensed. Its [transform tools](https://konvajs.org/docs/react/Transformer.html) provide a starting point, but snapping, layers, text editing, and history remain our work. Use browser-side PDF generation for visual handoff. The editable APL backup is **our own format**, not a `.fig` file: [Figma says its local formats are proprietary](https://help.figma.com/hc/en-us/articles/8403626871063-Save-a-local-copy-of-files).

Build mode will render real HTML/React components with Flexbox, Grid, and controlled decorative positioning. The existing Puck editor remains available for older projects while its functions are replaced incrementally by a canvas and controls designed for APL. The exported application stays Next.js with the owner’s Supabase and optional Brevo configuration. [Next.js supports full Node and Docker deployments; static export has limited features](https://nextjs.org/docs/app/getting-started/deploying). No exported site will call APL accounts, APIs, or private packages.

## Delivery phases

Each phase ends with a usable demonstration, a record of what is incomplete, and verification evidence. Design variety grows alongside functionality; it is not postponed to a final cosmetics phase.

| Phase | What we build | Acceptance gate |
|---|---|---|
| **0. Protect and measure the current app** | Back up current projects and source state; document existing behavior, export combinations, performance, and screenshots. Define the new document schema and migration fixtures without replacing version-7 pages. | Existing projects reopen unchanged; current export tests still pass; we have before screenshots and a migration test. |
| **1. Make APL itself credible** | Redesign the entry experience, project dashboard, and editor shell in the selected **editorial studio** direction. Show original, complete portfolio and business examples, interactive theme/design previews, and an honest demonstration of working exported features. Improve navigation and onboarding. | A new visitor can understand Design, Build, Preview, and Download; working examples are labeled accurately; desktop and mobile visual reviews pass. |
| **2. Design canvas foundation** | Artboards, frames, text, images, basic shapes, groups, layers, select/multiselect, drag, resize, align, snap, zoom/pan, undo/redo, local recovery, reusable colors and type styles. Download editable APL backup, PNG, and visual PDF. | A user creates and reopens a multi-artboard design and downloads matching files without an account or AI service. |
| **3. First design-to-code proof** | Guided conversion of one designed business page into semantic website sections. Add responsive frame rules, three breakpoint views, real links, a contact form binding, conversion warnings, and side-by-side visual comparison. Reuse the existing contact backend/export. | The same project yields design files and a clean Next.js export. At mobile, tablet, and desktop widths, the site matches the approved design closely and has no major overflow. The exported form saves a real submission readable by an independent admin with APL blocked. |
| **4. First useful dual-mode release** | Expand website editing to multi-page business and portfolio sites, shared header/footer, reusable components, service/project/article bindings, content editing, design variants, linked icons, and a shadcn-like **copy component code** flow. Deliver two genuinely distinct complete templates and a beginner deployment guide. | A noncoder completes both journeys, downloads source, runs its verifier, and deploys using their own services. Only selected modules appear in the export. |
| **5. Public beta** | Google and email builder accounts, multiple cloud projects, asset storage, revision history, collaboration-ready ownership, usage quotas based on measured bytes, six complete templates, and broader component recipes. | Cross-account isolation, save-conflict, backup/restore, quota, and independent security checks pass. Local design/export still works when cloud limits are reached. |
| **6. Production hardening** | At least 12 distinct complete templates; improved fonts, effects, CMS search, design-system management, accessibility and performance tools, update/migration guides, and verified owner-host deployment paths. | Supported exports pass clean-environment public/admin tests; upgrade and restore drills succeed; WCAG 2.2 AA and the applicable OWASP ASVS controls are reviewed. |
| **7. Commerce** | Product/variant catalog, cart, inventory, orders, store admin, shipping/tax configuration, sandbox checkout, then live-payment readiness. | Concurrent stock, duplicate events, failed payments, refunds, and fulfillment pass independent tests. Live payments appear only after the owner supplies an eligible merchant account; country support is checked then. |
| **8. Platform breadth** | More site types, richer drawing and motion tools, optional collaboration, and sustained library expansion toward **100+ meaningful designs per major component family**. | Each addition has a distinct visual purpose, a real preview, responsive and accessible behavior, and matching export tests. Colors or animation combinations alone do not inflate design counts. |

The **immediate next implementation batch** is Phase 0 followed by the first part of Phase 1: preserve the C: project, capture the current product baseline, design APL’s new visual system, and build a reviewable entry/dashboard/editor-shell prototype. It must demonstrate real capabilities rather than advertise features that are still planned.

## Design quality, exports, and verification

APL’s own presentation will use warm neutrals, ink tones, strong typography, deliberate whitespace, original imagery, and restrained motion—no neon default. The marketing experience will show complete sample sites and genuine editor actions. Award galleries such as [CSS Design Awards’ 2025 Atoll Digital entry](https://www.cssdesignawards.com/woty2025/sites/atoll-digital/) are references for composition and craft, not sources to copy. Every template needs its own art direction, responsive review, keyboard behavior, and performance budget.

A component will have a structural family, visual recipes, theme tokens, states, and optional motion. This lets the library grow without hundreds of unrelated implementations. Users can search and preview choices visually. The 100+ target applies to **meaningfully different, tested choices** in major families; reaching that scale across the entire catalog will take sustained work after the core product is reliable.

The three user-facing actions remain distinct:

1. **Preview** shows the real responsive frontend. Backend-dependent actions are plainly labeled as sample behavior inside the builder.
2. **Download design** creates an editable APL backup plus PNG artboards and a visual PDF. The PDF is a handoff image document, not an editable Figma file.
3. **Download website code** generates the selected frontend and backend source, admin interface where needed, migrations, assets, dependency lockfile, environment example, setup/deployment guides, and isolated verifier. The owner then deploys it on their own account.

Every generated website must install and build from a clean copy, run against separate test services with APL blocked, and exercise both public pages and selected backend/admin features. Security gates cover validated project data, safe content rendering, uploads, authentication and authorization, tenant isolation, secrets, backups, and recovery. Use [OWASP ASVS 5.0](https://owasp.org/projects/asvs?tab=main) as the verification target and [WCAG 2.2](https://www.w3.org/TR/WCAG22/) for accessibility. Independent review remains required before accepting real customer data or live payments.

A public builder cannot promise **domain-only cost at unlimited usage**. Current free allowances are finite: [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/) limits dynamic requests, and [Supabase](https://supabase.com/pricing) limits database and file storage. Owners pay for their own finished websites. We will measure project storage before setting cloud quotas and will not impose a one-project-per-user rule.

For one developer working with an assistant, allow roughly **2–4 months for a convincing dual-mode proof, 8–16 months for a useful public beta, and longer for a hardened platform**. Exact Figma depth plus 100+ tested designs across many families is a multi-year, team-scale ambition. These are planning ranges, not promises.

**What I need from you later:** review the Phase 1 visual prototype and test its beginner journey; provide branding or licensed imagery if you want specific assets. Builder cloud accounts are needed in Phase 5. Store merchant country and provider decisions wait until Phase 7. No API key, production credential, or purchase is needed to begin the next batch.

**Assumptions locked from your answers:** two connected modes; guided conversion; editable APL plus PNG/PDF design download; frames/layers/layout before vector drawing or multiplayer; editorial studio identity; business and portfolio first; exported sites belong entirely to their owners.
