# Phase 3: Guided Design-to-Build conversion

Completed and verified on 3 October 2026 against [the accepted roadmap](STUDIO-ROADMAP.md). This phase converts a selected business-page artboard into responsive semantic Website content, with explicit links and an optional working contact form. Commerce remains Phase 7.

## Try the complete journey

Choose **New project → Blank design canvas → Explore a business design**. The original Field & Form example includes editable desktop and mobile artboards, meaningful text, decorative artwork, services and a contact mockup. Select the desktop artboard and choose **Convert to website**.

The four-step review covers page details; sections, columns and reading order; heading levels, image descriptions and actions; and warnings with a visual comparison. Mobile/tablet/desktop layouts, spacing and supported appearance values have explicit inheritance. Buttons navigate to sections, existing pages, HTTP(S) websites, email addresses or phone numbers. The contact binding creates native name/email/message fields rather than preserving a picture of the form.

Acknowledge each warning, choose **Prepare comparison**, inspect all three widths and approve before **Apply to Build**. The comparison iframe really renders at 390, 768 or 1280 pixels, scaled to fit its panel. The new page is editable in Build. Original Design artboards and existing Website pages remain available. **Download design** produces editable APL, PNG artboards and a visual PDF; **Download code** produces an independent Next.js application and private complete APL backup from the same project.

## Conversion fidelity and review

The finite Website grammar remains Section → Columns → Column → Heading/Paragraph/Image/Button, with native Contact. Meaningful text, button labels and images stay native. Decorative shapes can be deliberately rasterized with their ancestor transforms and clipping; artwork containing meaningful text is rejected for flattening. The converter reports rotations, clipping, overlap, unsupported content, omitted layers and other changes before compilation. Text beyond Website bounds must be split deliberately, rather than silently truncated.

The approved example preserves its typography, colors, spacing, artwork and content closely at desktop width. Narrow layouts use the confirmed flow and column rules rather than the artboard's absolute coordinates. A real form also has validation and status behavior beyond the static mockup. The original and candidate remain visible together so those differences can be reviewed. This is guided conversion, not arbitrary drawing inference or exact Figma parity.

Website8 adds bounded per-property responsive appearance, stable section anchors, safe external/email/phone destinations, H1 and optional per-page header/footer. Legacy presets retain their appearance when no authored override exists. Supported native components expose Appearance controls in Build. Local system fonts are Arial, Georgia, system UI and monospace; custom font loading is later work.

The conversion wizard uses the existing labelled icon family, restrained transitions, keyboard focus states and narrow-screen layouts. Targeted geometry and keyboard checks are evidence for the exercised workflows; they are not a full WCAG audit.

## Connected updates and preservation

Studio9 contains Website8, unchanged Design1 and up to 50 compact version-one conversion records. Each record retains the approved plan, source artboard, generated roots, warning acknowledgements and SHA-256 source/target fingerprints. It does not duplicate assets or store complete historical source snapshots. Comparison reports current, Design changed, Website changed, both changed or detached.

Each connection retains its latest approved mapping. Updating it replaces that record; earlier mapping versions and conversion rollback are not retained. The original-format recovery archive protects Phase 2 Studio8 before its first Studio9 write, rather than creating a snapshot before every conversion.

Design edits never silently replace Build. **Compare conversions** prepares a fresh review. A Build conflict defaults to creating a separately addressed copy; replacing owned roots requires explicit confirmation and offers the current Build alongside the proposal. Replacement preserves unrelated roots, other pages and CMS data. Page details stay intact unless their separate update checkbox is approved. Missing/deleted references produce readable detached history.

The wizard rejects stale drafts and changes made while asynchronous preparation or application is pending. Its revision guard covers the current browser tab; cross-tab synchronization and multiplayer conflicts remain later work. A complete candidate is validated against the 30 MB envelope bound before staging. Design, Build and conversion share one queue, and applying stages and saves one complete envelope. A failed save retains the complete candidate for recovery backup and retry.

Frozen Studio8 and Website7 readers preserve earlier authored content, IDs and Design. Reads never rewrite stored originals. Before the first Studio9 write replaces Studio8, the exact raw envelope is archived once; **Download pre-conversion originals** returns that earlier format without mixing in current cached data. Earlier Website-original and workspace protections remain available. Imports and duplicates receive independent project IDs while retaining both documents and records. See [the document contract](DOCUMENTS.md).

## Independent website proof

The accepted website ZIP was downloaded through the actual UI after conversion. Every source file and its manifest content hash was validated before extraction. Its public runtime contains Website content and deliberate converted artwork; freeform Design data and conversion tools stay in the private backup. It requires no APL account, service, package or AI key. Builder contact previews remain simulated.

- UI ZIP: [accepted-converted-export.zip](../.artifacts/phase-3/accepted-converted-export.zip)
- ZIP SHA-256: `4565e6f5c851022da3b2a4765fa3aeb5614b6acf1939cdf1f62bebe93ce25abe`
- Manifest content hash: `10cbf0d306fb7b4811994bec327e252a42b42ea5d0e175d9474c88f0fbd8a0a2`
- Manifest format 8 / generator `0.8.0`, 64 hashed files plus manifest, with contact and admin-inbox modules
- Converted route: `/designed-page`
- Independent APL download matches the ZIP's private backup exactly: [receipt](../.artifacts/phase-3/accepted-export-receipt.json), [download proof](../.artifacts/phase-3/download-proof.json)
- Actual design output: [PNG-artboard ZIP](../.artifacts/phase-3/accepted-design-images.zip) and [two-page PDF](../.artifacts/phase-3/accepted-design.pdf)

The exact extracted artifact passed **26 independent runtime checks** after a clean standalone Next.js 16.3.6 build, using disposable Supabase and an internal runtime network with external access blocked. The verifier specifically selected the converted Contact from the private conversion record: `contactPagesVerified` is `/designed-page`. A real submission persisted in the database, appeared in the independently authenticated admin inbox and was marked read. Checks also covered public route/metadata and responsive content, button navigation, permission/role enforcement, cross-origin rejection, payload validation, atomic rate limits and message retention when notification delivery failed. The verifier exited successfully and removed only its disposable proof containers, network and image.

The [unchanged runtime report](verification/studio-conversion-2026-10-03.json) and [artifact/hash receipt](verification/studio-conversion-2026-10-03-artifact.json) match the ZIP's exact content hash. The report was checked at `2026-10-03T18:24:21.760Z`. See [the standalone log](../.artifacts/phase-3/accepted-standalone.log). Every future ZIP keeps its verification-required status; evidence applies to the exact artifact tested.

## Validation

- **213 unit checks in 26 files passed**, including migrations, original archiving, record-preserving saves/backups, limits, stale revisions, conversion mapping/fingerprints, rendering and deterministic selective export. [Unit log](../.artifacts/phase-3/unit-final.log).
- **TypeScript and the production build passed**, with 798 modules and no chunk-size warning. Conversion, canvas and PDF UI remain lazy loaded. [Build log](../.artifacts/phase-3/build-final.log).
- **All 46 browser journeys passed across the final runs:** 40 broad regressions, four separately redirected compatibility journeys, the exact accepted conversion/download/restore journey and one extra narrow-screen wizard journey. The cancellation journey belongs to the 40-run suite and also passed in the two-case acceptance run; it is counted once. Coverage includes authored responsive controls, explicit updates, conflicts, save recovery and existing CMS/canvas/editing flows. [UI acceptance log](../.artifacts/phase-3/browser-conversion-final.log), [40-journey regression log](../.artifacts/phase-3/browser-full.log), [compatibility log](../.artifacts/phase-3/browser-compatibility.log), [wizard phone/tablet/desktop log](../.artifacts/phase-3/browser-mobile.log).
- The extra phone check found intrinsic grid sizing and a three-pixel step-navigation overflow. Responsive columns now shrink within their panel, and phone step buttons put numbers above their labels. The final recheck covers every wizard step at 390/768/1440 and the actual three comparison viewports inside a 390-pixel host, with no horizontal overflow. Two intervening diagnostic processes failed before test execution due to temporary Windows memory pressure during the Docker image build; testing resumed after proof cleanup. [Phone controls](../.artifacts/phase-3/conversion-controls-390.png) and [phone comparison](../.artifacts/phase-3/conversion-comparison-phone.png) were visually inspected.
- **The 390/768/1280 comparisons were visually inspected.** The browser checks actual iframe viewport widths, semantic H1 and absence of horizontal overflow. [Mobile comparison](../.artifacts/phase-3/comparison-390.png), [tablet comparison](../.artifacts/phase-3/comparison-768.png), [desktop comparison](../.artifacts/phase-3/comparison-1280.png).

The source checkpoint at integration start is `.artifacts/phase-3/source-before-phase-3.zip`, SHA-256 `d962628a93d8d19d7aee8c2c57e01ccce1ea24700bd6397b10457e43e1384e0d`. It preserves the existing uncommitted source at that checkpoint and may include early schema work; it is not a clean Phase 2 Git commit. Existing accepted Phase 1/2 artifacts and historical reports remain preserved. The four compatibility journeys write their new ZIPs/screenshots under `.artifacts/phase-3/compatibility`; [the before/after hash receipt](../.artifacts/phase-3/immutable-export-hashes-proof.json) confirms that both historical Phase 1 ZIPs and the accepted Phase 3 ZIP remained unchanged.

## Remaining phases

Phase 4 covers the useful dual-mode release, reusable Website components, content bindings, component code copying and beginner owner deployment. Cloud identity/sync, richer templates, production hardening, commerce, multiplayer and broader drawing/motion retain their roadmap positions. Owner production deployment, live email delivery, comprehensive accessibility and independent security review remain unverified by this local proof.
