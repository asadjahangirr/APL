# Phase 4 — useful Design and Build workflows

Status: implementation is available; final local acceptance is in progress. Owner-host deployment has not been performed. This is a local prototype, not a public production release.

## Try the new workflow

1. Open New project. Under Design and Build, choose Atelier Meridian or Mira Sol, then Use website or Start in Design.
2. Build contains the complete native multi-page website. Design contains editable desktop and mobile homepage companions. These are separate documents: changing one does not silently rewrite the other. Guided conversion remains available for explicitly reviewed changes.
3. Use Pages and Site header & footer for navigation and branding. Shared header/footer changes apply throughout the site; individual pages can hide them.
4. Open Components in the Build toolbar. Each template includes a linked Start project invitation. Edit an instance in Build, select it as the update source, review the approval checkbox, and update its linked copies. Separately edited copies are protected unless you explicitly choose to replace them. Detach makes a copy independent.
5. Use Content collections for Services, Portfolio, and Articles. Save drafts separately from published snapshots. Portfolio cards can open an authored case-study page or an external project website. Preview is labeled sample behavior; it never writes to a production backend.
6. Select a Button or Icon to connect a page, website, email, phone, or published CMS record. The corresponding collection must be present for a CMS binding. Exported record links resolve the latest publication, so a changed slug or portfolio destination does not leave a bound action pointing at the original URL.
7. Choose Copy code to inspect the selected component, usage, styles, dependencies, images, and instructions. Download bundle creates an independent Next.js reference project containing only that component's necessary layout and functional modules. A link to an excluded page is visibly reported and changed to a top-of-page example; reconnect it in the receiving project.
8. Download code includes the complete selected website, its backend/admin modules, migrations, locked public dependencies, assets, environment example, setup/deployment guides, verifier, and private editable APL backup. Run that exact download's verifier, then deploy using your own accounts.

## Original complete templates

- Atelier Meridian: five authored pages, Services CMS with detail routes, journal/Articles, contact and inbox, warm architectural artwork, and a linked invitation on three pages.
- Mira Sol: six authored pages, two complete case studies, Portfolio CMS cards, Notes/Articles, contact and inbox, original publication artwork, and a linked invitation on four pages.
- Each has two editable homepage Design artboards. Other authored pages currently have native Build layouts; they do not yet have separate Design artboards.
- The older Northline Studio and Jordan Ellis examples and simple starters remain available.

Original template images are bundled. No award-site artwork or source was copied. The current icon collection has 14 controlled SVG symbols, including Home and Back. These are a small foundation for the larger library, not a claim of 100 designs per family. Current component recipe counts remain in DESIGN-LIBRARY.md.

## Data and export boundaries

Current documents use Studio10, Website9, and Design1. Website9 adds a bounded reusable-component library, linked root-section instances, optional collection bindings, and icon/button settings. Earlier formats migrate through frozen schemas; failed writes remain recoverable. Explicit current workspace snapshots and full Design data survive downloads.

Unused reusable blueprints, CMS drafts, and unconverted Design remain in the private owner backup or selected content seeds. Public site-data contains rendered page data and excludes the reusable library and link metadata. Rendered reusable sections are ordinary materialized components in the export, with no runtime dependency on APL.

The portfolio page-target migration is additive. It does not reset existing drafts or publications. The owner applies pending migrations in filename order. Imports insert missing IDs and preserve owner-edited existing content. Later design exports require new owner deployments; CMS data does not automatically synchronize back to APL.

## Verification record

The source-at-phase-start checkpoint and a later complete source checkpoint are retained under .artifacts. Earlier accepted phase ZIPs are also retained in .artifacts/phase-4/prior-acceptance before regression artifacts are regenerated.

Initial checks exposed missing editor/export connections, stale schema-version tests, missing schema support files in exports, and loss of current Studio Design data in one export path. These have been corrected with regression coverage. The first isolated portfolio run caught a syntax error in the new additive migration and correctly wrote not-verified; the migration was corrected before fresh acceptance exports were generated.

The patched stack passes 242 unit checks across 32 files and the production TypeScript/Vite build. Fresh registry audits for both builder and export-template lockfiles report zero advisories; see DEPENDENCY-REVIEW.md for the versions, the explicit Happy DOM compatibility override, and its dedicated test. A large entry-chunk warning remains and is not treated as a performance audit.

The first full browser run passed 47/50 journeys. Two test-contract failures were corrected (a legacy fixture included a newer field, and a manifest assertion used the document version); both then passed. A detached radio-control case passed unchanged on focused rerun after source edits stopped. Component clipboard copying also passed, and a new Home-icon authoring/preview/source-bundle journey passed. The complete 51-journey patched-stack run and exact independent acceptance exports are being checked before final evidence is recorded.

Independent setup successfully applied the corrected migrations. One normal run then stopped on a local Storage health timeout; a diagnostic-only restart showed healthy Storage and database services, no OOM flag, and successful Storage migration/startup logs. Diagnostic mode is not a verification pass. Normal verification keeps health checks enforced and denies external runtime access before executing application tests.

## Remaining release gates

- Verify the exact final downloaded templates in clean isolated Docker environments with separate Supabase credentials and external runtime access blocked.
- Perform an owner-account hosting deployment and smoke checks, including real email delivery if configured. The guide is documented; an actual deployment is a separate result.
- Obtain independent security review before public production use or collecting real customer data.
- Cloud accounts/sync, collaboration, retained server versions, measured quotas, six/twelve templates, broad font/motion libraries, arbitrary vector editing, and commerce remain in later phases. A shadcn CLI registry installer and arbitrary React round-trip import are not implemented.

No AI API key is required. Continue Phase 4 acceptance before starting Phase 5 cloud work.
