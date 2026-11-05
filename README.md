# APL Studio

A local-first Design and Website studio with independent Next.js source export.

**Latest implementation:** Phase 4 adds two original multi-page Design/Build templates, linked reusable sections, portfolio case-study destinations, labeled icons and button symbols, CMS record actions, and component source copying with independent bundles. Guided conversion, the freeform canvas, themes and independent full-stack exports remain available. See the [Phase 4 handoff](docs/PHASE-4.md), [document contract](docs/DOCUMENTS.md), [Design workflow](docs/DESIGN-CANVAS.md), and [roadmap](docs/STUDIO-ROADMAP.md).

**Status:** Phase 4 is implemented locally with final acceptance in progress. Current projects use Studio10, Website9, Design1 and versioned conversion records. Earlier Website/Studio inputs migrate through frozen schemas, and originals are archived before replacement. Phase 3's historical evidence remains in [PHASE-3.md](docs/PHASE-3.md). This is a local prototype; public cloud accounts, production readiness, and owner-host deployment acceptance remain separate gates. Older milestone numbers in historical progress entries refer to the earlier website-only plan.

Project location: C:\Users\ASAD\Projects\APL (moved here at the owner's request because E: was full).

## Start

Use Node.js 24. On this machine npm's global cache points to the full E: drive, so use a temporary C: cache:

    npm ci --cache C:\Users\ASAD\AppData\Local\Temp\apl-npm-cache
    npm run dev

Open http://127.0.0.1:5173. New visitors see the studio; returning visitors can open **Your projects**. Choose **New project** for Atelier Meridian or Mira Sol with editable homepage artboards and complete native websites. Northline Studio, Jordan Ellis, and simple starters remain available. The studio's live preview lets you try themes and hero compositions and preserve them in a new project. **Quick guide** explains the beginner journey.

Choose **Blank design canvas** to begin in Design, or select **Design** inside any existing project. Add your first artboard with a Desktop/Tablet/Mobile preset or custom size, or explore the editable design study. The icon toolbar adds frames, text, rectangles, ellipses and uploaded images. Use Layers to select, rename, lock, hide and organize; use Properties for precise dimensions, position, rotation, colors and typography. Drag or use keyboard controls, group a selection, snap to edges/centers, pan and zoom, and fit artboards on screen. **Canvas guide** explains the tools and shortcuts. Mobile screens provide Layers and Properties panels through the bottom controls.

Reusable color/type styles update their linked layers. Design history retains up to 50 immutable steps within a 64 MB memory bound for the current canvas session. Returning to a canvas starts a fresh undo history; its saved document persists. **Download design** offers an editable APL backup, artboard PNGs (a ZIP for multiple boards) and a multi-page visual PDF. PNG/PDF artwork is flattened; editability belongs in the APL backup. Design stays independently editable; confirmed conversion creates native semantic Website content in Build.

The dashboard supports search, sorting, renaming, independent duplication, individual backups and **Back up all**. Workspace ZIPs retain both documents, embedded assets and conversion records. Imports create independent projects. Earlier workspace and legacy-Website recovery downloads remain available; exact Studio8 originals are separately archived before their first newer-format write. Clearing browser data removes projects and local snapshots.

Try **Blank design canvas → Explore a business design** for the editable Field & Form demonstration. Select an artboard and choose **Convert to website**. Confirm page details, section/column reading order, mobile/tablet/desktop layouts, heading levels, image descriptions and button destinations. Bind a contact mockup to the standard working form if required. Acknowledge every warning, prepare the visual comparison, inspect all three widths and approve before **Apply to Build**. Later Design edits never silently replace Build. **Compare conversions** shows what changed; explicitly update the owned sections or create a separate page. Unrelated pages, authored sections and CMS content stay intact. Each connection retains its latest approved mapping; earlier mapping versions and conversion rollback are not retained.

In Build, select sections to edit, change page settings, preview, and download. Use **Pages** to add, rename, reorder, hide from navigation, or delete pages. Use **Site header & footer** for changes that apply everywhere, and **Content collections** for Services, Portfolio and Articles. The page selector chooses the content currently being edited; Preview supports working desktop and mobile navigation. **Download code** produces independent Website source and includes a private dual-document APL backup. Unconverted Design data remains private; content deliberately converted into Website is exported as ordinary native content, images and actions. **Back up** preserves editable APL data from both modes.

Use **Add layout** to compose a section from columns, headings, paragraphs, images and buttons. The custom **Outline** lets you select nested elements, add content and reorder siblings. Column widths use presets first, as selected by the owner, with separate mobile/tablet/desktop values and inheritance. Section padding, column gaps, alignment and content positioning are configurable. See [nested layout controls and bounds](docs/LAYOUTS.md).

Puck provides controlled arrangement; the builder owns immutable undo/redo snapshots, including nested edits and Outline reordering. History lasts for the current page editing session, retains up to 50 states with a memory bound, and groups rapid changes to the same field. Switching pages/projects, returning from preview, or applying page/shared-structure settings starts a new history session. Page creation/deletion/reordering and shared settings are not part of canvas undo. Page deletion has a confirmation step. Download backups before clearing browser data or making large changes.

Multiple projects remain in IndexedDB. Website retains its limits of 50 pages, 1,000 components including layout containers/shared records, and 10 MB. Design supports 24 artboards, 1,200 layers, 16 nested parents and a 20 MB document; the complete Studio10 APL backup limit is 30 MB, including up to 50 conversion records. Uploaded Design images must be PNG/JPEG/WebP under 2 MB, within 24 million decoded pixels. Raster exports are limited to 16 million pixels and 8,192 pixels per side for both the artboard and scaled output. These local safety bounds are separate from future cloud quotas. Frozen legacy migrations preserve authored Website content and IDs; version-one header/footer sections become shared and its homepage is `/`. See [multi-page behavior](docs/MULTIPAGE.md) and [dual-document contract](docs/DOCUMENTS.md).

Design and Build use one serialized save queue. Failed writes retain staged edits for recovery downloads and allow later retries. Closing a tab warns while saves are pending or failed, including after switching modes. A failed migration-original archive prevents replacement of that original project record. Unknown future formats or invalid Design/Website references reject import/load without replacing current data. Deleted conversion references remain readable as detached history.

Buttons currently have eight designs, three shapes and five motion choices (including None). Headers have four designs and heroes have six. Use Site header & footer or select a Hero/Button to choose a real-rendered thumbnail. These are the first reusable recipes; combinations and color changes are not counted as 100 distinct designs. The long-term goal remains 100+ meaningful designs across component families, plus effects, fonts and complete original website templates.

Use **Portfolio content** for cards that open authored case studies or external website links, with private drafts and explicit publication. Select the collection for six designs and optional motion. **Site theme** provides six palettes, custom color pickers and three system-font families. See [Portfolio](docs/PORTFOLIO.md) and [actual library counts](docs/DESIGN-LIBRARY.md). **Services content** and **Articles content** provide private drafts and publication for their public listing/detail pages and independent admin modules. **Components** manages saved reusable sections; **Copy code** provides source, dependencies, styles and independent component bundles. Selected functional components include their required backend setup.

Preview contact forms are explicitly simulated. Downloaded projects contain real server handlers and SQL, but backend functionality must pass the included Docker verifier before it is called verified.

## Checks

    npm run doctor
    npm run test
    npm run build
    npm run export:fixture
    npm run export:fixture -- --static
    npm run export:fixture -- --cms
    npm run export:fixture -- --cms-only
    npm run export:fixture -- --portfolio-only
    npm run export:fixture -- --portfolio
    npm run export:fixture -- --articles-only

The default and `--static` three-page fixtures are written to `.artifacts/layout-business-export` and `.artifacts/layout-static-export`. They exercise nested layouts and independent responsive output. The business fixture puts its contact form on `/about`; both include a nested `/about/approach` page hidden from the menu. The `--cms` and `--cms-only` variants include Services; `--portfolio-only` and `--portfolio` include Portfolio; `--articles-only` includes Articles without the contact module. Run `npm run verify` inside each fixture. Browser regressions live in `tests/*.spec.ts`; `npm run test:browser` requires installed Playwright browsers. Generated full-stack runtime tests require Docker Desktop using Linux containers. Consult [PROGRESS.md](docs/PROGRESS.md) for observed results tied to exact artifact hashes; generating a fixture alone is not verification.

`npm run doctor` only checks the local runtime; it does not prove backend functionality. See [Windows setup progress](docs/WINDOWS-SETUP.md) for the current machine's restart and installation steps.

## Export ownership

Exports contain only selected component implementations, required modules, public dependencies, owner-provided images, SQL, guides, and the verification runner. There is no builder API dependency or customer-site hosting. Credentials belong in the owner's local environment/hosting secret settings.

## Source layout

- src/project: canonical schema, templates, local storage
- src/design: validated freeform document, geometry/history, canvas controls and PNG/PDF exports
- src/conversion: guided mapping, warnings, provenance fingerprints and explicit Design-to-Build updates
- src/editor and src/site: Puck adapter and shared presentational components
- src/export: deterministic selective generator and browser ZIP download
- templates/base, templates/auth, templates/contact, templates/cms-common, templates/cms, templates/portfolio and templates/articles: independent application source, selected backend modules and runtime verification
- tests: schema/export and browser regression tests
- docs: decisions, roadmap, progress, security notes

## Dependency updates

Root package-lock.json locks the studio. templates/base/package-lock.json locks exports. After changing the export dependency manifest, run npm install --package-lock-only in templates/base, regenerate the affected module combinations, and independently install/build/test them. Supported selections combine optional contact, Services CMS, Portfolio CMS and Articles CMS modules. Test standalone modules, affected combinations and the static baseline. Never publish a changed exporter without these checks.

## Not implemented yet

Component source copying, the first linked icons, reusable sections, and two paired Design/Build templates are implemented in Phase 4. Broader design libraries, owner-host deployment acceptance, and cloud features remain pending. Services, Portfolio case-study/external cards, and Articles have independent backend modules. Current acceptance evidence is in [PHASE-4.md](docs/PHASE-4.md); historical evidence remains in PROGRESS.md.

Cloud accounts/sync, retained cross-session version history, password reset UI, automatic URL redirects, production anti-spam, email retry jobs, custom fonts, commerce and a large template library remain unimplemented. Arbitrary recursive Website layouts and per-device visibility remain outside the current manual Build controls. Supported native components expose responsive typography, colors, borders and spacing through Appearance controls; guided conversion preserves those validated properties. Rich vector/path editing and multiplayer design collaboration also remain later work.
