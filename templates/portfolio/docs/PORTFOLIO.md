# Operating your Portfolio CMS

Your exported website uses your own Supabase database and private image storage. It does not contact the builder. The builder preview shows sample content; the exported administrator saves real content in your configured backend.

## First setup

1. Follow the main setup guide. Apply all included SQL migrations in order to your own Supabase project. Use a separate project for tests.
2. Enter your own Supabase URL, browser publishable key, and server-only secret key in `.env.local`. Set `SITE_URL` to the exact origin you visit. Never commit credentials.
3. Run `npm run setup:content`. When Portfolio is selected, this includes `scripts/import-portfolio.mjs`, which imports `portfolio-seed.json` and uploads its images to the private `cms-portfolio-media` bucket.
4. Create your administrator using the main setup guide and sign in at `/admin`.
5. Open the authored page containing the Portfolio collection. Choose each card's destination in the admin: an existing case-study page opens in the same tab, or a complete external website URL opens in a new tab. The builder's Mira Sol template includes two authored case studies. Create additional case-study layouts in Build and re-export; the CMS edits card content and destinations, not page structure.

The initial import creates only missing IDs. Repeating it, applying a later design export, or importing Services alongside Portfolio does not overwrite existing drafts, publications, administrators, or inquiries. Manage deployed content through `/admin`; edits made later in the builder do not automatically update existing deployed records.

Interrupted imports can be repeated: completed records are preserved. Keep `portfolio-seed.json` and the project backup private because they contain unpublished drafts. They belong outside `public/`; do not publish a GitHub repository containing sensitive drafts.

## Draft and publication workflow

- **Save draft** updates the private working copy. The existing public snapshot remains unchanged.
- **Publish** makes the saved version public. A title and an existing page destination or complete `https://` or `http://` project URL are required.
- **Unpublish** removes the public snapshot and keeps the private draft. Future public image requests stop working.
- Save unsaved edits before publishing. Revision checks reject stale changes instead of overwriting edits from another browser.
- Titles, summaries, categories, and alternative text are plain text, escaped by React. They do not execute HTML or scripts.

Project URLs must be absolute HTTP(S) URLs without credentials, spaces, control characters, backslashes, or percent-encoded hosts. Explicit ports must contain one to five digits and be at most 65535. HTTPS is recommended. Relative paths, `javascript:`, `data:`, and credential-bearing URLs cannot be published. The server does not fetch or proxy project URLs; cards navigate directly in the visitor's browser with `noopener noreferrer`.

Internal destinations store a stable page ID and anchor. A later design export resolves the ID against its included pages. The admin refuses unknown page destinations; if a deployed design removes a referenced page, select a replacement before publishing that draft. The additive `20261017000000_portfolio_internal_targets.sql` migration preserves existing external cards and publications.

The collection uses stable ascending record-ID order, matching the builder preview. Manual sorting, search, filters, deletion, and galleries are not included in this release. The deployed CMS supports 200 projects; the builder seed editor supports 50.

## Images and privacy

Upload a non-animated PNG, JPEG, or WebP up to 2 MiB and 24 million decoded pixels. The server decodes actual pixels, removes embedded metadata, and creates a WebP with a longest side of at most 1600 pixels. A filename or declared MIME type alone is not trusted.

The image bucket is private. Only the server holds the secret key. Administrators preview through an authenticated endpoint. Public image requests resolve the current published snapshot each time and use `no-store` caching; private drafts never make their images public. Copies already downloaded by a visitor cannot be revoked.

Replacing a draft image leaves older objects intact so an existing publication or concurrent edit remains valid. Monitor owner-controlled Storage usage. Unreferenced image cleanup is manual: back up first and confirm that neither `cms_portfolio.draft` nor `cms_portfolio_publications.payload` references an object before removing it. Do not make the bucket public to fix a preview error.

## Updates and troubleshooting

Back up database records and private Storage objects separately, and test restoration on a separate Supabase project. Apply versioned migrations without resetting production. Source deployments do not require reimporting initial content.

- **Backend setup is incomplete:** check environment variables and migrations.
- **Invalid origin:** set `SITE_URL` to the origin used in the browser.
- **Project changed:** reload the saved version before applying a new edit.
- **Invalid project URL:** include HTTP(S), remove credentials and whitespace, and check the host and optional port.
- **Image unavailable:** check private bucket setup, service health, limits, and owner storage quota.
- **No projects visible:** add a Portfolio collection to a page, save a valid draft, then explicitly publish it.

Run `npm run verify` against the exact export before deployment. Its isolated backend proof does not check whether external project websites are reachable or prove that your production hosting account is configured. Perform the deployment guide's smoke checks on your own host.
