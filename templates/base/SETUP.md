# Run your independent website

This project belongs on your accounts. No builder account, API, database or private package is used.

## 1. Verify the download

Install Node.js 24 and Docker Desktop, start Docker, and use Linux containers. The first run downloads container images and browser dependencies and can take several minutes. The verifier requires at least 10 GiB free on its temporary-files volume before preparing Docker. This is minimum headroom, not a total size guarantee; check free space on the Docker data drive too.

Open a terminal in this folder:

    npm ci
    npm run doctor
    npm run verify

The doctor command is a read-only prerequisite check. It distinguishes a missing Docker installation, a stopped engine, Windows-container mode and a remote Docker context. Verification requires a local Linux engine. The checker also detects standard Windows Docker installations when the current terminal's PATH has not refreshed.

The verifier checks the original export hashes, copies only manifest-listed files into a fresh temporary folder, starts a separate local Supabase project if needed, builds the real application, and exercises public pages and each selected admin module. Services and Portfolio checks include private drafts, publication, images, conflicts and repeat-safe initial imports. Portfolio destinations are validated and tested through a local intercepted browser response; verification never fetches the real external websites. It checks all routes at mobile, tablet and desktop widths, including nested column proportions, spacing, component order, local images, button destinations and reduced-motion behavior when selected. The application and its tests run on an internal Docker network without internet access. Production environment files and credentials are not copied. Every Docker and Supabase command is pinned to the checked local engine; the verifier does not change your saved Docker context.

A successful run writes verification-report.json with status "passed" and this export's hash. Any failure or missing Docker writes "not-verified" and exits unsuccessfully. An editor preview or successful build alone is not backend verification. Check the report before deployment. Browser/email-provider delivery and hosting configuration also need owner smoke tests.

The runner never links to a hosted Supabase database. Test containers are stopped afterward. The temporary workspace and logs remain for inspection; its path is printed.

Supabase initialization briefly uses a separate setup network because Docker Desktop's internal networks do not expose the database port needed by its CLI. The CLI publishes development ports 54321, 54322 and 54324, which may bind to all interfaces. Run verification on a trusted computer/network; this setup is not suitable for a public server. Only disposable test credentials and schema are initialized there; CLI credentials are redacted from logs. Before starting the exported application, the runner disconnects every service from that setup network, preserves its internal service names, verifies that no other networks remain, and removes the setup network. All application and browser tests then run with external access blocked; failure to isolate a service stops verification. The runner does not change Docker's global configuration or the computer's firewall.

If Windows reports insufficient disk space during installation even though your project drive has room, check both the user and system TEMP/TMP locations. Installers can use a different full drive. Do not delete unrelated files or change machine-wide settings without the computer owner's approval. WSL feature installation can require a restart. Follow the official Windows instructions: https://docs.docker.com/desktop/setup/install/windows-install/ and https://learn.microsoft.com/windows/wsl/install.

## 2. Configure your services

If export-manifest.json lists no backend modules, skip Supabase and administrator setup.

Otherwise, create YOUR Supabase account and project. Copy .env.example to .env.local and supply the project URL, publishable (or legacy anon) key, and server secret (or legacy service-role) key. Never expose the secret key in browser code or commit .env.local.

In Supabase Auth settings, keep the Email provider enabled so your administrator can sign in, and turn off the global option allowing new users to sign up. These are separate controls. The included local configuration makes the same distinction, and verification checks that public registration is rejected while administrator login succeeds.

If the contact module is selected, generate CONTACT_HASH_SECRET:

    node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

Set SITE_URL to your exact local address, initially http://localhost:3000. Apply every SQL migration in supabase/migrations in filename order to your NEW project using the Supabase SQL editor, or install the official Supabase CLI and use its link/db push workflow. Never run db reset against a production database.

Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 16 characters in .env.local, then run:

    npm run setup:admin

Remove those two bootstrap values after success. Visit /admin to sign in. There is no public registration or default password. Contact submissions start empty. If a CMS collection is selected, follow its included docs/SERVICES.md, docs/PORTFOLIO.md, or docs/ARTICLES.md and run npm run setup:content after migrations. The dispatcher imports only selected collections. It imports initial draft/published records and private images; it never overwrites existing IDs. Seeds and the project backup contain private drafts: keep the repository private and never serve those files as public assets.

## 3. Run locally

    npm run dev

Open http://localhost:3000. Exercise each selected module: send a contact message and inspect the inbox; create a service or article draft, confirm its URL is not public, Publish it, then confirm the public page updates. For Portfolio, save a card with a title and a case-study page or complete HTTP(S) website link, confirm the draft is invisible publicly, publish it, and check its destination. Internal pages open in the same tab; external websites open in a new tab. The administrator screen and backend API responses report setup errors when required configuration is missing.

## 4. Optional email notifications

Create your own Brevo account and authenticate a sender domain. Set BREVO_API_KEY, BREVO_SENDER_EMAIL and CONTACT_NOTIFY_EMAIL in your server environment. Submit a message and inspect the delivery status in /admin. Missing email configuration does not prevent storing messages.

Supabase authentication SMTP is configured separately in your Supabase dashboard, using your own Brevo SMTP credentials. Its default email service is restricted to evaluation and is unsuitable for general production delivery. Follow https://supabase.com/docs/guides/auth/auth-smtp. A Brevo API key for contact notifications does not configure Supabase SMTP. Password recovery UI is a later milestone; this release uses the securely bootstrapped admin account.

## 5. Deploy and operate

Follow DEPLOY.md. Keep your project backup separately. This prototype needs an independent security review before accepting real customer data.

## Pages and future edits

Every selected page has its own readable `app/.../page.tsx` route and metadata. `site-data.json` holds rendered page content; unused reusable blueprints remain only in the private project backup. `site-navigation.json` contains resolved links. Buttons and icons bound to CMS items use stable record handlers, so a later published slug or portfolio destination change is followed without rebuilding the design. The corresponding collection module must be selected. Shared header/footer rendering lives in `src/site/SiteShell.tsx`. Pages hidden from navigation still have public URLs; this is not access control.

Page URLs can include up to four lowercase path segments. The homepage stays at `/`; backend and asset paths are reserved. Changing a page URL requires a new deployment. Automatic redirects from old URLs are not generated yet. The builder limits this prototype to 50 pages and 10 MB per project backup, including images. These are local document bounds, not cloud storage quotas or a limit on the number of projects.

Current editable backups use Studio10 with Website9 and Design1. Supported earlier Website and Studio backups migrate without changing authored content. Version-one headers and footers become shared sections; existing body content keeps its order. Shared header/footer placement is fixed at the beginning/end of each page, with per-page visibility. Keep original backups because older builders cannot open newer formats.

## Nested layouts and component styles

Layout sections can contain headings, paragraphs, images, buttons and column groups. A column group contains up to four columns; columns contain those leaf components. Arbitrarily recursive sections and columns are intentionally unsupported. These rules keep responsive layouts predictable and the saved document bounded. Draft containers may be empty in the builder, but exports require content in every section, column group and column.

Column presets include stacked, equal halves/thirds/quarters and two-column proportions of 1:2, 2:1, 1:3 and 3:1. You can choose separate presets at mobile, tablet (768px+) and desktop (1024px+). Missing tablet/desktop overrides inherit the smaller-screen value. Section padding, column-group gaps and spacing between column contents use the same inheritance. Width and alignment use controlled settings; this release does not include dragging a column edge to resize it.

The generated route JSX preserves the validated tree and imports only the selected component implementations. Responsive rules live in the selected components, layout helper and stylesheet. Layout images are copied to local assets. CMS draft images are kept in the private initial seed and imported into owner-controlled private storage. Button destinations are resolved from stable page IDs; missing destinations stop export with an actionable message. Buttons link to pages/sections; they are not arbitrary script hooks. Image placeholders can remain visible when no image has been selected; upload finished images before publishing.

Button appearance currently has eight designs, three shapes and four optional motion effects plus None. A small bundled icon set supports decorative or labeled linked symbols and button icons. These choices are the beginning of the reusable library; they do not represent 100 finished designs per family. Reduced-motion preferences suppress decorative motion.

The project limit is 1,000 components including shared sections and layout containers, alongside the 50-page and 10 MB backup limits above. The saved tree, readable route source and component props are independent of the builder. After editing source manually, use Git to merge a later design export; arbitrary React source cannot be imported back into the editor.

Known prototype boundaries: fixed contact fields, most recent 100 inquiries, no cloud saving, no password-reset UI, no notification retry worker, no live payments. Nested layouts and a small style collection are implemented; the large design library remains planned.

## Updating an existing contact-only export

Keep the production database and its data. The new 20260925000000_auth.sql bootstrap is idempotent and may be applied to an existing installation; it preserves administrator identities. If the Supabase CLI reports this earlier migration is missing, review the pending list before using its --include-all migration option. The historical contact migration now uses CREATE TABLE IF NOT EXISTS for site_admins so a fresh CMS-only project can add contact later. Do not re-run that entire contact migration on an existing installation. Apply the new services migration only once, then run the insert-only setup:content command. Test this upgrade on a backup first.

## Collection designs and themes

The first visual collection batch contains six Portfolio recipes (Gallery, Editorial, Split, Poster, Index, Framed) and four Services CMS recipes (Classic, Tiles, Bands, Spotlight). These are structural designs; recoloring and motion choices are not counted as additional designs. Index and Bands use one column. Other recipes honor saved mobile/tablet/desktop column settings.

Palette colors and the selected system-font family are retained in the exported theme. Six builder palette presets are available, with custom accent, background, surface, text, secondary text and border colors. Test custom colors for contrast. Hover effects also respond to keyboard focus, and reduced-motion preferences disable decorative animation. The larger component/style library is still being built.
