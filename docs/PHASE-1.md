# Phase 1: APL's editorial studio

Implemented on 1 October 2026 against the owner's accepted dual-mode plan. The earlier repository milestone numbers describe the website-only editor and are not the phase numbers used here. Phase 2 is the freeform Design canvas.

## Usable demonstration

Open `http://127.0.0.1:5173/#/welcome` for the entry experience. Preview Northline Studio or Jordan Ellis without creating a project. Follow actual page links, try mobile/tablet/desktop widths, and use the sample contact form. In the live component lab, change the theme and hero composition and choose **Start with this look** to preserve those choices in an editable project.

Open **Your projects** for search, sorting, rename, independent duplication, individual APL backups and **Back up all**. A workspace ZIP contains ordinary `.apl.json` files and restore instructions; extract it and import the desired files. Import always creates a new project ID and preserves originals. A separate browser database keeps one immutable recovery snapshot of the first existing workspace opened by this update. Its download appears on the dashboard. Both current and recovery data remain local and are removed by browser-data clearing, so downloadable backups matter.

Build keeps the existing Puck editing functions and introduces a clearer shell: project selection, Design/Build distinction, pages/shared layout/theme controls, content collections, preview, APL backup and independent code download. Design opens an honest explanation of the next phase. **Quick guide** explains the complete beginner workflow, sample behavior, backup restoration, and owner-controlled setup/deployment.

## Original examples and visual direction

- **Northline Studio:** three complete pages, framed shared navigation, serif introduction, original architectural artwork, numbered service rows, approach content and a contact page.
- **Jordan Ellis:** four complete pages, editorial sans-serif introduction, original illustrated project work, two internal case-study routes and a contact page. It uses semantic page sections rather than an empty portfolio collection.

Brands and case studies are explicitly fictional. Every page uses the working website schema and ordinary exported components. Artwork was created for APL with `scripts/create-example-art.py`; the small WebP files are bundled locally and included in exported assets. No external image service, image license purchase, API key or account is required.

The brief is an editorial overhaul of the entry experience, using native CSS and the existing editor. Design variance 6, motion 2, density 3: warm paper, ink, a restrained green accent, Georgia for the editorial brand headings, system sans-serif for controls, deliberate whitespace, sharp preview frames, and small state/hover transitions. Reduced-motion preferences disable transitions. The design skill informed the marketing surfaces; the working editor remains the existing product UI.

## Protection and changes

Before implementation, preserved source in `.artifacts/phase-0/source-before-phase-1.zip`, staged/unstaged binary patches, and the original Git status. The source ZIP SHA-256 is `88b96f760bcf9a8d78b59435fd23b0209d4fbc13b67fa0420f04cfea17bd31e1`. Before screenshots were captured from that preserved source in an isolated browser on port 5174; no user browser projects were replaced. The document contract and migration requirements are in DOCUMENTS.md. The live format remains v7; v1–v6 imports retain their frozen migrations.

Serialized local saves prevent older writes from completing after newer edits. Routing reads the current project list synchronously, including newly imported projects. Failed saves retain the correct in-memory recovery data even if a different project saves successfully. Invalid imports preserve existing projects.

The clean example export build exposed a footer type error: generated JSON widens recipe values to `string`. The generator now parses footer props through the validated Footer definition, as it already does for Header; its schema import also covers footer-only sites. This fix applies to existing exportable footer recipes as well as the new examples.

The entry page loads independently of the editor, preview and CMS managers. Editor CSS loads with the editor. Puck's packaged `no-external.css` avoids its external font import. The entry JavaScript chunk decreased from about 976 KB to about 478 KB uncompressed; entry CSS decreased from about 116 KB to about 39 KB. These are build output sizes, not total transferred JavaScript or measured Core Web Vitals. The production build has no large-chunk warning.

## Verification evidence

The baseline passed 118 unit/export tests and a production build. The updated builder passes 120 unit/export tests, including an explicit v7 preservation fixture, and its TypeScript/production build. Repeatable browser journeys cover the existing editing/CMS features and the new visitor, live example, project-dashboard, import/restore, immutable recovery, workspace ZIP, save-failure recovery, responsive screens and source-download flows.

Before screenshots: `.artifacts/phase-0/entry-desktop-before.png`, `editor-desktop-before.png`, and `editor-mobile-before.png`. After screenshots are in `.artifacts/phase-1/`, including welcome at 390/768/1440, new-project mobile, empty/populated mobile dashboard, Build desktop, and the Northline approach page. The entry, dashboard and example pages have no major horizontal overflow in the tested widths. Desktop/mobile screenshots were visually inspected.

The final combined browser run passed **19 journeys**. An additional targeted responsive check passed after adding an explicit mobile-editor screenshot and overflow assertion. An earlier run reached the shared-settings radio assertion before its lazy dialog finished loading under parallel compilation; the journey now waits for the actual dialog, and the final combined run passed. No timed sleeps were added.

Both examples passed clean `npm ci` installations and independent Next.js production builds. Northline's exact accepted ZIP passed **21 isolated runtime checks** against disposable Supabase with external/Builder access blocked: public routes and responsive navigation, real contact persistence, administrator login/inbox/mark-read, unauthorized access and role escalation, payload/origin validation, concurrent email/global rate limits, and retained messages after notification failure. The report is [Northline runtime evidence](verification/studio-northline-2026-10-01.json), content hash `62ff97ef5074068ed1891194b10b25f11142985a87bbc4712c7d2411c1aa963f`. All 57 manifest files in the accepted ZIP match their recorded SHA-256 hashes and the passing report.

Jordan Ellis's exact accepted ZIP passed **25 isolated runtime checks**, including its case-study routes, responsive navigation, contact persistence, administrator workflow and access controls. The report is [Jordan Ellis runtime evidence](verification/studio-ellis-2026-10-01.json), content hash `8e917cd0482dcde5455cf5eb8039fc4543f5837cd66524662a7bd1431d7345bf`. All 67 manifest files match their recorded SHA-256 hashes and the passing report. Both disposable verification stacks were stopped after their checks.

Artifacts used by the independent verifier are preserved separately from later test downloads under `.artifacts/phase-1/accepted-*-export` and their matching ZIPs. `scripts/archive-studio-verification.mjs` checks every ZIP member and the report/content-hash match before archiving evidence.

## Remaining scope

Freeform artboards/layers/transforms/history/styles and PNG/PDF design downloads belong to Phase 2. Guided conversion/comparison, copy-component code, broader templates, cloud accounts/sync, advanced drawing, commerce and the 100+ recipe target remain on the current roadmap. Existing website code is preserved; no incomplete canvas schema is activated.

These checks do not constitute an independent security review, full accessibility audit, production deployment, real merchant/payment setup, or a guarantee against every possible failure. Backend actions in builder preview are simulated. Each new or edited source download retains the verification-required label. The owner can now review the real Phase 1 interface and beginner journey.
