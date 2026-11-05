# Current: studio Phase 3 completed and verified (3 October 2026)

The accepted [dual-mode roadmap](STUDIO-ROADMAP.md) now includes guided Design-to-Build conversion. The four-step review confirms page details, semantic content/reading order, responsive layouts/appearance, real button destinations and an optional contact binding. Original artboards and existing pages stay editable. The comparison renders actual mobile/tablet/desktop viewports; warnings and all three sizes require approval before application. Try **New project → Blank design canvas → Explore a business design → Convert to website**. See [Phase 3 workflow and evidence](PHASE-3.md).

Saved projects use Studio9 with Website8, Design1 and compact conversion records. Frozen Phase 2 Studio8 originals are archived before their first replacement, while earlier Website/workspace protection remains available. Conversion updates are explicit, preserve unrelated Build content and reject stale reviews. Failed saves retain a complete recovery backup. Each connection keeps its latest approved mapping; it is not retained version history. See [the document contract](DOCUMENTS.md).

Acceptance passed: **213 unit tests across 26 files, all 46 browser journeys across the final runs, TypeScript/production build, visual responsive review and 26 independent full-stack runtime checks**. The extra phone check caught grid/navigation overflow; the fix and focused recheck passed at 390/768/1440. The exact UI-downloaded Next.js export built independently and its `/designed-page` form saved a real submission, shown and marked read in its independently authenticated admin inbox with external networking blocked. The verifier cleaned only its disposable resources. [Runtime report](verification/studio-conversion-2026-10-03.json), [artifact receipt](verification/studio-conversion-2026-10-03-artifact.json).

Accepted ZIP SHA-256: `4565e6f5c851022da3b2a4765fa3aeb5614b6acf1939cdf1f62bebe93ce25abe`. Manifest content hash: `10cbf0d306fb7b4811994bec327e252a42b42ea5d0e175d9474c88f0fbd8a0a2`, with 64 hashed files plus manifest. The same project produced actual PNG-artboard ZIP/PDF files and a separately downloaded complete APL backup matching the source ZIP's backup. Earlier accepted artifacts remain preserved; evidence applies to this exact export. Phase 4 is next. Cloud accounts, commerce, production owner deployment and later hardening remain pending.

---

# Studio Phase 2 completed and verified (3 October 2026)

The accepted [dual-mode roadmap](STUDIO-ROADMAP.md) now has a freeform Design canvas alongside the existing Build editor. Implemented controls cover artboards, hierarchical frames/groups and layers, text/images/shapes, transforms, selection/alignment, snapping, pan/zoom, bounded undo/redo, reusable color/type styles and APL/PNG/PDF downloads. Dashboard covers show Design artboards and offer a direct Design action. The guided conversion from Design into a responsive website remains Phase 3.

Saved projects use a validated v8 envelope preserving the v7 Website document and its CMS publication snapshots. Design/Build writes share one queue; failed edits remain downloadable. Original legacy website records are archived immutably before a v8 save replaces them, and the earlier workspace recovery snapshot remains available. Imports and duplicates retain both documents under independent project IDs. Downloaded Website source contains its complete private backup while public runtime data/assets remain Website-only. See [Phase 2 implementation notes](PHASE-2.md) and [document contract](DOCUMENTS.md).

Acceptance passed: 164 unit checks, all 37 browser journeys covered across the combined run and scoped rechecks, TypeScript/production build, visually inspected 390/768/1440-pixel layouts, actual PNG/ZIP/PDF outputs, and a fresh standalone static website install/build/runtime check. See [Phase 2 evidence](PHASE-2.md) for commands, recheck details and exact artifact hashes. One multi-selection resize now creates one save/undo step; numeric field focus preserves precision. Combined backup budgets are checked before edits enter either document. Phase 1 verification below remains evidence for its earlier accepted artifacts, not proof of every new Phase 2 export. Phase 3 guided conversion is next. Cloud services, commerce, production deployment and other later phases remain pending.

---

# Studio Phase 1 completed (1 October 2026)

The owner's [dual-mode product brief](STUDIO-PRODUCT-BRIEF.md) and [studio roadmap](STUDIO-ROADMAP.md) define the phase numbers. The historical website-editor records below keep their original numbering and evidence. At this Phase 1 checkpoint, the next phase was **Phase 2: freeform Design canvas**.

Phase 0 protected the existing source and recorded the document contract. Phase 1 adds the editorial welcome screen, two complete editable examples, live theme/composition choices, searchable project dashboard, workspace/recovery downloads and a responsive Build shell. Existing project formats and editing/CMS functionality remain supported. The Design control explains the upcoming canvas; it does not claim canvas functionality.

Validation: 120 unit/export tests, 19 browser journeys, the TypeScript/Vite production build and clean independent Next.js builds for both examples passed. Northline passed 21 isolated runtime checks; Jordan Ellis passed 25. Accepted ZIP contents were checked against their manifests and matching reports. See [Phase 1 implementation and evidence](PHASE-1.md), [Northline report](verification/studio-northline-2026-10-01.json) and [Jordan Ellis report](verification/studio-ellis-2026-10-01.json).

Production deployment, a full accessibility audit and independent security review remain unverified. Later roadmap phases are still pending.

---

# Historical Phase 2 update: header, hero and button compositions (27 September 2026)

Implemented 4 shared-header recipes (previously 1), 6 hero recipes (previously 2), and 8 button recipes (previously 4). Real component thumbnails, separate motion controls, existing theme controls and identical export renderers are connected to the builder. Schema v6 migrates validated v1-v5 backups without replacing their content or IDs. The 100+ options per family remain a long-term target.

A separate four-page Alex Morgan sample now demonstrates Home, Work, About and Contact. The older one-page demo and existing browser projects were retained. Import demos/alex-morgan-multipage/alex-morgan.apl.json to edit the complete sample. Local demo contact actions remain explicitly simulated and project destinations use example.com. See [controls, demos and limits](COMPOSITIONS.md).

## Verification
- 111 unit tests passed across 14 files; final TypeScript/Vite build and both demo builds passed. Existing large-bundle warnings remain.
- Connected-browser checks observed six hero layouts at 390 and 1366px and four working mobile menus at 390px (16 checks), without horizontal overflow in the tested sample.
- Connected-browser follow-up completed: Framed header, Inset hero/Image unveil, and Arrow tab/Pill/Surface sweep/button destination survived reload or reopening. All four demo pages passed at 1366/768/390px; all six heroes and four headers passed additional 768px checks. Mobile navigation closes after page changes, Back to top preserves the current page, and contact sample mode confirms nothing was sent. [Review evidence](verification/compositions-browser-review.json). A separately named review project preserved existing user content. Browser transport was intermittent, but the listed checks completed in fresh tabs. No application-code changes were needed.
- Clean export verification: **42 runtime checks passed**, including all four routes/metadata, responsive layouts, navigation, admin login, real contact persistence/inbox, rate limits, permission enforcement, Portfolio draft/publish behavior, private images, and repeat-import data preservation.
- Exact artifact hash: `a8c2391a1c26eecc47c8fca26d8508653d36c66cbf2e8fb311668ab4cee274d6`. 77 source files plus manifest. [Runtime report](verification/compositions-portfolio-2026-09-27.json), [ZIP/source integrity](verification/compositions-integrity-2026-09-27.json).
- ZIP bytes match regeneration from final source. Services backend handlers are excluded from this Portfolio/contact export. Test credentials and services were disposable; runtime external/builder access was blocked.
- The first proof caught JSON header-design type widening in generated SiteShell. Export now validates header settings at that boundary, and the clean build/runtime passed. A final no-image alignment correction was included in the final proof.
- Owner-host deployment, production email delivery, independent security review and comprehensive accessibility testing remain unverified.

## Next agreed work
Articles CMS using the established draft/publish workflow, paired with footer/common-section designs, then two complete distinct starter templates, component copying and owner deployment acceptance. The new four-page demonstration is not yet a selectable complete template. Phase 2 remains partial; no public cloud release or commerce functionality is claimed.

---

The following records describe earlier exact artifacts and historical counts.

# Phase 2 update: linked portfolio projects and visual library (27 September 2026)

The portfolio and visual-library slice is implemented and verified. The final Portfolio-only, combined Portfolio/Services/contact, and static export artifacts passed independent runtime checks. Phase 2 remains partial. The historical Services proofs below apply to their older exact artifacts.

## What is new

- Portfolio cards open the supplied project website in a new tab. There is no internal portfolio detail page. Drafts can be incomplete; publication requires a valid absolute HTTP(S) link and title.
- Portfolio content supports Save draft, Publish for export, Unpublish, images and separate draft preview. Later draft edits leave the previous public snapshot unchanged.
- Six Portfolio designs (Gallery, Editorial, Split, Poster, Index, Framed) and four Services CMS designs (Classic, Tiles, Bands, Spotlight) have real visual selectors.
- Site theme provides six restrained palettes, six color pickers and three system-font families across every page. Collections offer three optional effects plus None, respecting reduced motion.
- Independent exports include only selected backend modules, private image storage, revision checks, additive migrations and an insert-only seed importer. Combined exports include separate Portfolio and Services admin tabs without overwriting either collection.
- Schema v5 migrates validated older projects and keeps existing layouts unchanged. New portfolio starters select the Portfolio collection.
- The verifier checks native temporary-volume free space before creating Docker resources. Its 10 GiB minimum is headroom; Docker image storage can require additional space.

## Checks completed

103 unit tests, TypeScript and the production builder build passed. All 11 editor browser workflows passed; Portfolio and Services journeys both passed again after the final theme corrections. Screenshot inspection found and fixed conflicting generic dialog CSS. The visual harness checked ten collection designs at three widths (30 geometry checks), keyboard radio controls and reduced motion. A separate actual-component audit passed 126 text-color checks across Studio, Ink and Nocturne, including contact fields, sample warnings, placeholders and contrast buttons, with no 390px overflow. [Theme audit measurements](verification/portfolio-theme-2026-09-27.json). Reference and product screenshots were inspected; this is not a full accessibility audit. The large editor-bundle warning remains.

The runtime proofs use fresh generated artifacts and isolated Supabase with builder/runtime internet access blocked. A missing fixed Portfolio image route in the manifest verifier allowlist was found and corrected; both boundary tests pass.

Final Portfolio-only export: **33 independent runtime checks passed**, hash `42da0b5da548b87d50c15ac08b8e2cde38f35b4bec283296692483eabffa4f0b` (79 source files plus manifest). [Exact report](verification/portfolio-only-2026-09-27.json). The ZIP, report and regeneration from current source match exactly. Checks cover owner authentication, real drafts/publication, private images, API/SQL URL validation, responsive designs, external destination navigation and repeat imports. Its proof resources were removed.

Final combined Portfolio + Services + contact export: **57 independent runtime checks passed**, hash `deab27bd76cf998394f5c09006f72ff366da67e888901f16aec96b201701b34e` (104 source files plus manifest). [Exact report](verification/portfolio-business-2026-09-27.json). Both CMS collections, shared admin, actual contact persistence/inbox, permissions, images, revision conflicts, notification-failure handling and repeat imports passed together. Initial imports preserve deployed collection records and inquiries.

These reports apply to these exact final artifacts. Every new user download still requires its own verification. Earlier attempts found the manifest path omission; visual inspection found dialog styling and fixed-color gaps. Those were corrected before the final source freeze and proofs. Builder access and runtime internet access were blocked during the independent checks; owner production email delivery and deployment remain untested.

Current static regression: **13 independent runtime checks passed**, hash `37f9f577390397659fb946b54a6759c80954b7f2f4dc50431d30e425dac30572` (48 source files plus manifest). [Exact report](verification/portfolio-static-regression-2026-09-27.json). The downloaded ZIP matches every manifested file; this proof's containers, network and image were removed after completion.

Final cleanup confirmed that this batch's proof containers, networks and tagged images are gone. The builder returned HTTP 200 at http://127.0.0.1:5173 and approximately 45.9 GiB remained free on C:. Source, project data, checkpoints, generated downloads and inspection evidence are retained.

## Limits and next work

The current count is six Portfolio designs, four Services CMS designs, four button designs and two hero designs. Six color palettes are not six additional component designs. The two starters still share an overall shell; they do not yet count as two distinct complete website templates. The 100+ meaningful options per component family remains a target.

Portfolio bounds are 50 builder seed records and 200 exported records; sorting is stable by ID. Deletion, manual sorting, rich text and portfolio detail pages are outside this slice. Cloud accounts, production email delivery, owner-host deployment acceptance, recovery drills and independent security review remain incomplete.

Next: a navigation/header, hero and button visual batch, followed by Articles, two complete distinct templates, component copying and the owner deployment journey. Visual-library batches will accompany functional work instead of waiting until the last phase.

See [Portfolio usage](PORTFOLIO.md), [exact design counts and reference research](DESIGN-LIBRARY.md), and [the updated milestone plan](PLAN.md). No new accounts or credentials are needed for this local slice.

---

# Historical Services milestone (27 September 2026)

The **Save draft, then Publish** Services slice is implemented and verified. Static, contact-only, CMS-only and combined Services/contact exports have all passed their independent runtime checks. Phase 2 remains partial; portfolio projects, articles, two distinct templates, component copying and owner-host deployment acceptance are still outstanding.

## New behavior

- **Services content** manages titles, URL slugs, summaries, plain-text bodies and images. New records remain private. Save draft preserves the previous public snapshot; Publish for export replaces it explicitly; Unpublish retains the draft.
- Draft detail preview is separate from the main published-snapshot preview. Listings and details work at desktop, tablet and mobile sizes with shared navigation. Static Services/cards remain unchanged.
- The independent export includes selected CMS handlers, owner-admin editing, listing/detail routes, private image storage, SQL policies/migrations and a repeatable initial-content importer. It uses the owner's Supabase without builder access. Contact and its inbox are separately selectable.
- Exported admin Save draft/Publish/Unpublish operate on the owner's real database. Revision conflicts return 409 instead of silently overwriting changes. Leaving unsaved edits requires confirmation. Re-importing an updated design preserves existing owner records and contact submissions.
- Schema v4 migrates supported older backups without replacing page content. Draft seed content stays outside public data/assets. Public images resolve only through the currently published record.

**Publish for export does not deploy a website.** Builder content prepares the initial download. After owner deployment, ongoing content changes happen in the exported `/admin` and are not synchronized back to the builder.

## Verification

Final builder checks: **76 unit tests and TypeScript/production build passed**. All ten editor browser workflows have passing results across the combined run and targeted reruns. The final CMS journey was rerun after fixing accessible Summary/Body labels; it verifies that nonempty saved content survives reload and reopening. Screenshots of the content manager and responsive service detail were inspected. The large editor-bundle warning remains.

- **CMS-only export: 30 runtime checks passed**, hash `57c6e0e06a7e71b6d4519e7a8d8985ebc4319bfdf89616e4a1f1edc7be98aa61` (73 manifested files). [Exact report](verification/cms-only-2026-09-27.json).
- **Services + contact export: 39 runtime checks passed**, hash `76f37ea39c733cf30ed2193f3448b737503ab17bdb6388173622200f80a679ea` (79 manifested files). [Exact report](verification/cms-business-2026-09-27.json). Disk files, ZIP, manifest, report and current-source regeneration match exactly.
- **Static regression: 12 runtime checks passed** after disk recovery, hash `05510b00091335b9bfad6b851189d3f7e2a7cd36f7691b3a9727c6ac44b367be` (46 manifested files). [Exact report](verification/services-static-regression-2026-09-27.json). Historical reports below refer to older artifacts.

- **Contact-only regression: 23 runtime checks passed**, hash `c4f948afd6ec647a82a703b24c9d0212ed3a39c0e414f2065de78713343c51c3` (60 manifested files). [Exact report](verification/services-contact-regression-2026-09-27.json). The public website, real form persistence, owner login, inbox, authorization, rate limits and notification-failure handling passed with external access blocked.

The fresh proof copies install locked dependencies, build Next.js, apply migrations to disposable Supabase, and exercise the public website and real admin. Runtime internet/builder access is blocked. Checks cover draft privacy, publication transitions, unsaved-edit guards, active-session authorization, RLS, safe text, payload bounds, revision conflicts, unique slugs, image validation/private access, repeated imports and missing-credential errors. The combined proof also covers actual contact persistence, inbox actions, rate limits and preserving messages after notification failure.

Earlier attempts exposed and fixed an invalid test-session lifecycle and textarea accessible names. The final CMS reports supersede those earlier failed CMS attempts.

C: then filled during Docker image unpacking. Docker subsequently reported a read-only metadata filesystem and could not finish static-proof cleanup (`proofd0a1ac494025`, workspace `C:\Users\ASAD\AppData\Local\Temp\apl-proof-Pvdljq`). Removing about 5 GB of obsolete internal build cache did not reclaim enough Windows space; a disposable Vite cache was also removed to save the handoff. Source and saved projects were preserved.

After the owner freed about 55 GB, Docker recovered, the unchanged static export passed, its old failed image and empty network were removed, and the builder restarted at http://127.0.0.1:5173. The Vite cache regenerated. The restored Services browser journey passed; its total timeout is now 60 seconds to accommodate cold dependency optimization, consistent with other longer editor journeys. Assertions are unchanged. No folder ownership or Windows access-control changes were made.

The resumed contact proof also passed after recovering a stalled download of the same pinned Supabase CLI; see [Windows recovery details](WINDOWS-SETUP.md). All four archived reports match their exact export manifests and runtime reports. The downloaded ZIPs were checked against those manifested sources. Final cleanup confirmed no containers, networks or images remain from the resumed static/contact proofs or their failed attempts. About 51 GiB remained free on C:, and the builder returned HTTP 200 on port 5173. Generated downloads still require their own verification; these results apply to the recorded artifacts.

## Limits and next work

Builder bounds: 50 seed services within the existing 10 MB project backup limit. Exported CMS: 200 records, bounded raster uploads, 24 million decoded pixels and 1600px resizing. Plain-text bodies, fixed detail presentation and slug ordering remain; deletion, manual sorting, search, rich text and automatic URL redirects are not included. Replacement private images require deliberate cleanup. Database and uploaded-file backups are separate.

The 100+ meaningful designs per component family target remains planned; this slice adds CMS functionality. Cloud accounts/sync, password recovery, real provider email delivery, owner-host deployment acceptance, backup/restore drills and independent production security review are not complete.

Next within phase 2: portfolio projects using this collection boundary, then articles, two distinct complete templates, component copying and the beginner owner-deployment acceptance journey. No new credentials are needed for the local prototype. Check native disk free-space measurements before future large verification downloads.

See [Services usage and architecture](SERVICES.md). The material below records earlier completed milestones and their historical artifacts.

---

# Historical layout handoff — 27 September 2026

## Milestone status

**Milestone 0's independent full-stack proof passed.** A clean business export built and ran against disposable local Supabase services, with no builder or internet access during application/browser tests. Its real form, administrator login, inbox, database permissions and rate limits passed. Editor foundation work is also included. This is a local prototype, not a public beta or production release.

The multiple-page portion of milestone 1 is implemented and verified. The owner confirmed shared headers and footers across every page. Its six editor browser journeys, 35 unit tests and both three-page exports passed. That historical evidence is retained below.

The nested-layout slice is implemented and verified, using preset column widths as the owner selected. Sections contain controlled column groups and individual headings, paragraphs, images and buttons. The page tree supports selection, additions and sibling reordering without dragging. All 60 unit tests passed, all nine browser workflows have passing results, and both independent layout exports passed their runtime checks. See [layout usage and limits](LAYOUTS.md). CMS remains outstanding.

The original E: workspace was empty and its drive full. The owner authorized moving the project to `C:\Users\ASAD\Projects\APL`. Existing application code was not replaced. No cloud services, real credentials, customer-site hosting, or payments have been configured.

## Usable now

- Create multiple local projects from business and portfolio content starters. These are variations of one layout, not two distinct complete templates.
- Create, rename, reorder and delete pages; edit URL paths and menu visibility. One homepage remains at `/`; nested paths are supported. Internal links follow stable page identities through URL changes. Deletion requires confirmation and repairs a shared action targeting the removed page.
- Edit the shared header/footer through Site header & footer; changes appear on every page. Puck edits page-specific hero, services/cards, text and contact sections. Each page currently supports one hero, services section and contact section, plus repeated text sections.
- Edit page metadata, accent color, system-font family and per-device card columns. Upload a bounded raster hero image, which is decoded, resized and bundled into the export.
- Recover saved designs from IndexedDB after reload; export and import validated project backups. Browser storage is local and can be cleared by the browser/user.
- Undo/redo through immutable document snapshots. Rapid changes to the same field are grouped. Up to 50 states are retained with a 20 MB soft memory bound (at least two states). History resets on reload, page/project switch, structural settings or return from preview. Undo reopens page settings and retains the viewport. Page operations and shared settings are not included in canvas undo; use backups for structural recovery.
- Preview desktop, tablet and mobile in an iframe, with working page links and a mobile menu. Contact submission uses an explicit sample message and sends nothing.
- Download a ZIP containing selected React components, a Next.js application, a dependency lockfile, bundled images, setup/deployment instructions, a project backup and checksummed manifest.
- Selecting contact includes backend handlers, Supabase migrations and restricted database access, secure administrator bootstrap, login/inbox source, and optional Brevo notification handling. Removing contact excludes that module and its runtime dependencies.
- Version-one and version-two documents migrate to schema version 3 without changing existing content. New nested layout containers have stable IDs, validated children and a 1,000-component project bound. Existing limits remain 50 pages and 10 MB per backup including images; these are local safety bounds, not measured cloud quotas or a one-project restriction. Hidden menu pages remain public URLs.
- Add a complete two-column layout, select individual nested elements, and use the page tree to add/reorder content. Column presets and numeric spacing values support mobile, tablet and desktop with explicit inheritance. Changing width presets never deletes columns.
- Configure section width/background/padding, column alignment, spacing inside columns, heading size/level, image proportions/corners, and button destination/design/shape/motion. The first button collection contains four designs; combinations of colors/shapes/motion are not counted as 100 designs. The extensive library remains planned.

## Verification evidence

| Check | Observed result |
|---|---|
| Schema, legacy migration, nested tree adapters, page/link operations, selective export, injection/path boundaries, backup size, checksums, history, Docker prerequisites and service isolation | 60 automated tests passed |
| Builder TypeScript and production build | Passed; large editor-bundle warning remains |
| Full contact export: clean `npm ci` and Next.js production build | Passed |
| Export without contact: pruned dependency lockfile, clean `npm ci` and production build | Passed |
| Browser interaction | Created two projects; edited and recovered data; switched projects; checked undo/redo and persistence; used mobile sample form; generated ZIP through the UI |
| Export HTTP checks with no backend credentials | Public page 200; helpful admin setup screen; inbox 401; wrong-origin contact 403; invalid contact 400; unconfigured valid contact 503 |
| Verifier with Docker unavailable | Correctly exits unsuccessfully and writes `not-verified`, rather than claiming a pass |
| Repeatable Playwright editor journeys | 9 passed across the combined run and one targeted rerun: the previous six workflows plus nested editing/style/preview/export, page-tree additions/reordering, and physical column alignment |
| Isolated Supabase login, RLS, contact persistence, inbox and concurrent rate limits | Passed against the real exported production application |
| Public registration, cross-origin requests, invalid/oversized bodies and role escalation | Rejected as required |
| Missing email settings and failed notification delivery | Inquiry remained in the database; delivery state was recorded |
| External access during runtime | Blocked by internal Docker networking; unexpected browser destinations rejected |
| Export without backend modules | Final artifact passed: responsive public website, external access blocked, contact/admin routes absent |
| Downloadable ZIP integrity and cleanup | Both ZIPs match their passed manifests; no proof Supabase containers or proof networks remain |
| Owner email delivery, deployment on Render/Vercel, backups/restore, independent security review | Not executed |

Browser interactions were exercised through the repeatable Playwright CLI suite. The final combined run passed eight workflows and timed out on the existing mobile page-navigation journey; that journey passed on a separate rerun without changing its code (40 seconds). The nested test selects the actual page-tree button and uses keyboard activation for Puck's overlaid radio input. An independent code review found that unconditional column height defeated top/center alignment; the renderer was corrected and a browser regression now checks actual geometry for all three alignment modes. Final screenshots of the page tree, visual button selector, desktop layout and mobile stacking were inspected. No WCAG compliance claim or full accessibility audit has been made.

## Milestone 0 acceptance artifacts (historical)

The business report is `.artifacts/business-export/verification-report.json`. It records 14 completed checks and the exact source content hash:

`ea972522aa96c764b6b240e8662a215352adc93c87b5efb9fbc86725e18e1c87`

Checked at `2026-09-26T20:18:14.767Z` (27 September in Pakistan). The clean proof workspace is `C:\Users\ASAD\AppData\Local\Temp\apl-proof-a7zO3Y`. Its disposable services and runtime image were cleaned up after the pass. No production account or credential was used.

The no-backend export passed three checks at `2026-09-26T20:19:51.518Z`, with content hash `0b0e401c08892ed892bce858600e1b1740bddfa2f5fbdf5a770d384024acbf46`. Its proof workspace is `C:\Users\ASAD\AppData\Local\Temp\apl-proof-4kxlvH`. Both downloadable ZIPs were checked file by file against their manifest hashes after verification. Historical report copies are retained in [business verification](verification/business-2026-09-27.json) and [no-backend verification](verification/static-2026-09-27.json).

Generated ZIPs remain labeled "verification required": this report applies to the tested artifact, not automatically to every future download. Each owner should run their own download's verifier. Setup uses temporary development ports that may bind beyond localhost; use a trusted computer/network. All website/runtime tests begin only after setup connectivity is removed. Details and reproduced integration failures are in WINDOWS-SETUP.md.

## Multiple-page acceptance artifacts

Current fixtures are `.artifacts/multipage-business-export` and `.artifacts/multipage-static-export`, with ZIPs alongside them. Each has `/`, `/about` and `/about/approach`; the last page is hidden from navigation but directly accessible. The business form is on `/about`, proving backend module selection is site-wide.

The final business artifact passed 17 checks at `2026-09-27T07:07:43.522Z`, hash `9e210e4fb4d9726d12af490ec2ec88bf5d7019b89bf2ce3e088d187f4957f3cc`. Its clean proof workspace is `C:\Users\ASAD\AppData\Local\Temp\apl-proof-e1m8QM`. See the archived [business verification report](verification/multipage-business-2026-09-27.json).

The no-backend artifact passed six checks at `2026-09-27T06:59:38.249Z`, hash `d735994b8da9dd29a0f550fc7bc89ad4486867e1578666eef536bdc2e427dea9`. Its clean proof workspace is `C:\Users\ASAD\AppData\Local\Temp\apl-proof-NwrzI6`. See the archived [no-backend verification report](verification/multipage-static-2026-09-27.json).

All 44 business files and 35 no-backend files in the downloadable ZIPs match their manifest hashes and verified source files. Both reports match their respective manifest content hashes. No proof Supabase containers or proof networks remained after cleanup. These results apply to these exact artifacts; future downloads still require their own verification.

## Nested-layout acceptance artifacts

Current generated fixtures are `.artifacts/layout-business-export` and `.artifacts/layout-static-export`, with ZIPs alongside them. Both preserve the three-page journey and add a nested section with an independently packaged image, responsive column proportions/spacing and a button targeting another page.

The business artifact passed 21 checks at `2026-09-27T08:26:39.815Z`, hash `6e1867c5837afab89946ccc7589f83013f1c2a5a0a56fbea0adb8fb5973668a8`. All 53 files in the ZIP match the manifest and verified source. Its clean proof workspace is `C:\Users\ASAD\AppData\Local\Temp\apl-proof-qZvxhZ`. See [layout business verification](verification/layout-business-2026-09-27.json).

The no-backend artifact passed 10 checks at `2026-09-27T08:23:19.052Z`, hash `cb18fb35fa1ad66b649e57afe314fd9d75d712f04b243711ecb69b527d809613`. All 44 files in the ZIP match the manifest and verified source. Its clean proof workspace is `C:\Users\ASAD\AppData\Local\Temp\apl-proof-Qtxrhv`. See [layout no-backend verification](verification/layout-static-2026-09-27.json).

Runtime checks covered all three routes at mobile/tablet/desktop widths, real grid proportions, responsive gaps/padding, section width, actual alignment, content order, locally bundled image loading, working button navigation and reduced motion. The full-stack artifact also passed the real Supabase/admin/contact scenarios with builder/internet access blocked during runtime. Report hashes match the exact downloadable ZIPs. Future downloads still require their own verification.

## Next bounded milestone

Begin the CMS portion of milestone 2 with one agreed collection, its public listing/detail presentation and real administrator editing. Services is the proposed first collection. Verify that administrator changes persist and appear publicly in an independent export. Projects and articles then follow the same proven content model. Two distinct complete designs, code copying and owner deployment acceptance also remain in milestone 2.

## Remaining scope

CMS, reusable content, code-copy UI, cloud Google/email accounts, cloud sync/conflict handling, retained versions, measured byte quotas, six/twelve distinct templates, custom fonts and an extensive component/effects library remain future work. The current layout slice does not include divider resizing, arbitrary recursive nesting, per-device visibility or responsive typography. Automatic redirects for changed URLs, password recovery, reliable email retries, production abuse controls, monitoring, backup/restore tooling and commerce also remain. See PLAN.md for milestone order and SECURITY.md for review requirements.

No new account or credential was needed for this layout milestone. Confirm the first CMS collection and its public/detail-page presentation before that implementation; services is a reasonable first collection for the business journey. No payment provider decision is needed now.

## Follow-up: local runtime preparation

The owner approved moving the two Windows system temporary-file settings from the full E: drive to C:. That change succeeded, the WSL Windows feature was enabled, and the owner restarted Windows. Completed and verified the official installer downloads, installed WSL and per-user Docker successfully (both exit code 0), and started Docker's Linux engine. No additional restart was requested. The prerequisite check passed. See WINDOWS-SETUP.md for logs, cleanup and recovery notes.

Added `npm run doctor` to the builder and every export. It provides distinct setup errors, checks that Docker runs Linux containers, rejects remote daemon targets, pins the verified local endpoint for Docker/Supabase commands, and avoids an unrelated remote Buildx builder. These controls have unit coverage, including Windows environment-variable casing.

Disabled unused Supabase realtime/storage services for the current contact-only module. The isolated runtime scenarios for oversized payloads and retained submissions when Brevo delivery fails passed, using fake test credentials and the blocked outbound network. Fixed browser security-policy hostname validation and the local email-provider setting during actual verification. Login remains enabled while public registration is explicitly denied and tested.

## Articles CMS and common-section batch — 28 September 2026

Schema version 7 adds Articles as an optional CMS collection with separate draft and published snapshots. A selected export contains owner-controlled Supabase tables, private image storage, administrator editing, public listing/detail pages, initial content import, setup instructions and its own isolated runtime suite. Old v1–v6 backups migrate without rewriting authored pages. The editor preview uses local sample records and labels backend behavior as sample-only.

The visual catalog now adds four Articles listing designs, four shared footer designs, three static Services/cards designs and three Text-section designs. Each recipe keeps the same validated content and theme values; design selection changes the composition. The Articles and shared-footer pickers use real component thumbnails. Static Services and Text also have real-rendered thumbnails in the editor. These are current counts, not the 100+ design goal.

`npm run test` passed 118 tests across 16 files; `npm run build` passed. The Articles editor browser journey passed: local draft survival after reload, published-snapshot privacy, sample listing/detail navigation, responsive widths, static Services and shared-footer design selection, and independent ZIP contents. Screenshots are `.artifacts/articles-list-preview.png` and `.artifacts/articles-detail-preview.png` and were visually inspected. The builder build still reports a large-chunk optimization warning.

The Articles-only export in `.artifacts/articles-only-export` passed 32 checks in a clean isolated Docker/Supabase proof, with content hash `aa1b039723739bb5ef4bc85b4316901afe41eda485a1a48028cf9648210ce598`. See the archived [Articles-only report](verification/articles-only-2026-09-28.json). It verifies real administrator editing, page updates, draft/publication privacy, images, unauthorized access, conflict handling, import preservation and missing-credential behavior with external runtime network access blocked. An initial proof attempt failed because the verifier did not recognize the new Articles module as requiring disposable Supabase; that selection was fixed and the exact export passed. No production credentials were used.

The combined Articles/Services/Portfolio/contact export in `.artifacts/articles-business-export` passed 73 checks, hash `e919ebc0248306b6b367c90e9f5839c748f802118873a27d67de77cdbd1a5a7d`; see its archived [all-modules report](verification/articles-all-modules-2026-09-28.json). It exercised every selected backend and admin module with disposable credentials and blocked external runtime access. The Articles-only ZIP contains 80 manifest files; the combined ZIP contains 124. Every ZIP member matches its manifest hash and passing report. These reports apply to these exact exports, not future downloads.

The new footer/common-section recipes have not received a full accessibility audit. A separate owner-host deployment, production email, cloud accounts and independent security review remain undone.

Next agreed phase-2 work after this batch: two genuinely distinct complete website templates, then a component-copy workflow with readable source/dependency instructions. The owner also requested linked icon/symbol controls such as Home and Back; their validation and accessibility design is recorded in PLAN.md for a later batch. No 100+ family is claimed complete.
