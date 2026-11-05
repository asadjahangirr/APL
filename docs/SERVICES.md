# Services CMS — phase 2, first collection

The owner selected **Save draft, then Publish**. Saving edits never changes the last published snapshot. This slice adds one real collection; it does not complete phase 2 or the large design library.

## Try it in the builder

1. Open a project and select **Services content**.
2. Choose **Add services collection to this page**. This selects the CMS module for export and reserves `/services` and its detail routes.
3. Select **New service**, fill its title, URL slug, summary and body, and optionally upload a PNG/JPEG/WebP image.
4. **Save draft** stores the record locally. **Preview draft** shows its detail presentation without publishing it.
5. **Publish for export** copies the saved draft into the project's public snapshot. The main responsive Preview now includes its listing and detail page.
6. Edit and save again: main Preview continues to show the previous published version. Publish explicitly to replace it. Unpublish removes the snapshot but preserves the saved draft.
7. Download the independent project. Follow its SETUP.md and docs/SERVICES.md, run its verifier, then configure your own Supabase and hosting.

The builder's Publish for export does not deploy anything. Its records prepare the initial download. The deployed website has its own `/admin`; later owner content changes happen there and are not synchronized into the builder.

## What the export includes

Only selecting a Services collection adds its backend, private seed/importer, collection and detail routes, admin editor, additive SQL migration and private media handling. Contact and its inbox remain separate optional modules. CMS-only exports retain login and Services administration without contact handlers or Brevo settings. Exports use public dependencies and owner credentials, without builder accounts, services or packages.

The public `/services` listing and `/services/[slug]` pages query published snapshots at runtime, so owner content updates do not require a new source export. These routes share presentation with editor preview. Initial records include private drafts and published snapshots; these remain in private `content-seed.json` and the design backup, never in public assets or `site-data.json`. Keep source repositories private if they include private authored drafts.

## Data and publication rules

Services originated in schema v4. The current schema is v5 and also supports Portfolio content and theme tokens. Validated older backups migrate without changing existing sections or IDs. Static Services/cards remain supported; adding the CMS does not convert or delete those cards.

Each record has a stable UUID, saved draft payload, nullable published snapshot, revision and publication revision. Fields are title, URL slug, summary, plain-text body, image and alternative text. New/partial drafts may be incomplete; publishing requires a title and valid unique slug. HTML is rendered as text.

The exported database separates private `cms_services` from `cms_service_publications`. Server-authorized transactions lock a record and check its revision before save/publish/unpublish. A stale edit returns HTTP 409 instead of overwriting a newer change. Concurrent publication uses a unique slug constraint. Save leaves public data untouched; Publish copies the persisted draft atomically. Unpublish preserves the draft. Public lists use ascending URL-slug order in both preview and export; manual ordering is not implemented.

## Images and initial imports

Builder uploads decode and resize to bounded WebP images. The exported backend accepts authenticated raster uploads only, validates actual image format/dimensions, re-encodes using Sharp, and stores generated filenames in the owner's private Supabase bucket. Authenticated admin previews use temporary browser blob URLs. Public image requests resolve only the current published record; they cannot request arbitrary storage paths or draft images.

The importer uses deterministic seed-image names and inserts missing record IDs only. Running it again preserves existing drafts, published records, identities and submissions. Changing a design export does not reset production content. Replacement images remain private until explicit cleanup; automated orphan cleanup, garbage collection and retention controls are deferred. Back up database records and storage objects separately.

## Bounds and remaining work

The builder supports 50 service seed records within the existing 10 MB project backup limit. The exported CMS supports 200 records, with a 2 MiB limit for decoded or uploaded images and a maximum of 24 million pixels; images are resized to 1600 px. These are technical prototype bounds, not measured cloud quotas. There is no deletion UI, manual sorting, rich-text editor, search, categories, service-specific layouts or automatic redirects yet. Changing a published slug changes its URL; the former URL returns HTTP 404.

Articles, two distinct complete templates, component copying, owner-host deployment acceptance, password recovery, cloud accounts and production hardening remain. The Services collection now offers Classic, Tiles, Bands and Spotlight, with responsive columns except the single-column Bands design. Site theme changes shared colors and typography; optional collection motion respects reduced motion. The goal of 100+ meaningful designs per component family is unchanged; see DESIGN-LIBRARY.md for actual counts. An independent security review and backup/restore drill are still required before real customer data.

## Primary references consulted

- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control): private objects, policies and server-only service credentials.
- [Supabase database functions](https://supabase.com/docs/guides/database/functions): transactional operations and function privileges.
- [Next.js dynamic routes](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes): generated listing/detail routes and asynchronous route parameters.
- [Sharp image constructor](https://sharp.pixelplumbing.com/api-constructor/): decoded-image limits and safe raster processing.

Verification evidence and current acceptance status are recorded in PROGRESS.md. A generated download always remains verification-required until that exact artifact passes its included runner.
