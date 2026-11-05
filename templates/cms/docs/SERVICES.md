# Operating your Services CMS

This application uses your own Supabase database and private Storage bucket. Your builder account is not needed after export. The editor's local preview is sample behavior; this exported admin interface uses your configured backend.

## First setup

1. Follow the main setup guide and apply every SQL migration in order to your own Supabase project. Use a separate project for tests.
2. Enter your own Supabase URL, browser publishable key, and server-only secret key in `.env.local`. Set `SITE_URL` to the exact origin you visit, including the local port during development. Never commit this file.
3. Run `npm run setup:content`. It imports authored service drafts and published snapshots and uploads their images to the private `cms-service-media` bucket. Public pages use the published snapshots.
4. Run the administrator setup command from the main guide. Visit `/admin` and sign in with that administrator.
5. Test a public service at `/services` and `/services/your-slug`. A new draft has no public detail page until you publish it.

The initial import only creates missing record IDs. Repeating the import or applying a later design export does **not** overwrite existing service drafts, publications, administrators, or form submissions. Manage live content through `/admin`. If you change a record in the builder after the first import, that change does not update the existing deployed record automatically.

An import interrupted halfway can be run again. Completed records are skipped. If a new imported publication conflicts with an existing published URL, fix that initial slug and export again. Original data is preserved. Content-seed files and project backups contain private drafts; keep them outside `public/` and out of public GitHub repositories when their contents are sensitive.

## Draft and publication workflow

- **Save draft** changes only the private working copy. Visitors keep seeing the existing published snapshot.
- **Publish** copies the saved draft to the public snapshot. A nonempty title and a lowercase URL slug are required. The slug must not already be used by another published service.
- **Unpublish** removes the public snapshot and keeps the private draft. Its public detail page and image endpoint become unavailable.
- Each operation checks a revision number. If another browser session saved first, reload to see its version before applying your changes. A conflict never silently overwrites newer edits.
- The body is plain text. HTML, JavaScript, and code pasted into it are displayed as text, not executed.

Changing a published slug changes its URL. This release does not create redirects from the old URL. Keep established URLs stable where possible. Public listings use ascending URL-slug order, matching the builder preview; manual ordering is not available yet. This CMS currently supports up to 200 services; the builder's initial-content editor supports 50. Search, pagination, bulk editing, scheduled publication, and deleted-record recovery are later additions.

## Images and privacy

Upload a non-animated PNG, JPEG, or WebP of at most 2 MiB and 24 million pixels. The server decodes the image, removes metadata, and creates a WebP up to 1600 pixels on its longest side. Give informative images useful alternative text.

The Storage bucket is private, with no browser-role upload or download policy. Only the server holds a secret key. Administrators preview images through an authenticated endpoint. Public image requests check the current published snapshot each time and use `no-store` caching; unpublished draft images are not made public. A visitor who already downloaded an image cannot have that copy revoked.

Replacing or removing a draft image does not delete previously uploaded files. This preserves a still-published snapshot and avoids breaking concurrent edits. Review Storage usage in your own Supabase dashboard. Unreferenced media cleanup is manual in this release: back up first and confirm the object is referenced by neither `cms_services.draft` nor `cms_service_publications.payload` before removing it. Never make the bucket public to solve an admin preview issue.

## Backups, updates, and troubleshooting

Back up the database and the private Storage objects separately; database backups do not contain uploaded file bytes. Record your migration version and test restoration in a separate owner-controlled Supabase project. Apply later migrations without resetting a production database. Re-deploying source alone does not require importing initial content again.

- **Backend setup is incomplete:** check server environment variables and migrations; do not expose the secret key in a browser variable.
- **Invalid origin:** make `SITE_URL` match the address used in your browser. Configure production separately from localhost.
- **Content changed / URL already in use:** reload before retrying, and choose a unique published slug.
- **Image could not be stored:** check the private bucket migration, file limits, Storage service availability, and your account quota.
- **No services are visible:** sign in as an administrator, save a complete draft, then explicitly publish it.

Run `npm run verify` on the exact export before deployment. It uses isolated local services and does not prove delivery by your real email provider or the reliability of your live hosting account. Run the production smoke checks from the main guide after deploying.

Implementation references: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [database functions](https://supabase.com/docs/guides/database/functions), [Sharp image input limits](https://sharp.pixelplumbing.com/api-constructor/), and [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
