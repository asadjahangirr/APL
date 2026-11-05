# Portfolio CMS and case-study pages

Portfolio cards open an existing authored case-study page in the same tab or the owner's supplied HTTP(S) website in a new tab. The Mira Sol template includes two complete case-study pages. Create page layouts in Build; use Portfolio content to edit cards and their destinations.

## Try it

1. Create a Personal portfolio project, or open an existing project and choose **Portfolio content**.
2. If needed, choose **Add portfolio collection to this page**.
3. Choose **New portfolio project**. Enter a title, choose a case-study page or external website link, and add an optional category, summary, and image with alternative text.
4. **Save draft** stores a private local record. **Publish for export** creates the public snapshot. Later draft edits leave that snapshot unchanged until another explicit publication.
5. Close the manager and select the collection in the canvas. Choose a design thumbnail and motion option. Configure columns per breakpoint; Index intentionally stays a single-column list.
6. Open **Site theme** for six palettes, custom color pickers, and three system-font families. Apply the theme across all pages.
7. Preview at mobile/tablet/desktop widths. Portfolio links open their supplied websites; contact backend actions remain explicitly simulated.
8. Download, run the independent verifier, and follow SETUP.md and docs/PORTFOLIO.md on your own service/hosting accounts.

New portfolio starters include this collection by default. Existing saved projects keep their old sections.

## Data and export

Schema v5 adds content.portfolio and expanded theme colors. Supported v1-v4 backups migrate without replacing authored pages or Services drafts/publications. Existing Services design remains Classic with no motion until changed. Editing either collection preserves the other.

Each record has a stable ID, private draft, nullable published snapshot, revision and publication revision. Fields: title, summary, category, externalUrl, optional target, image and imageAlt. Published records require a title and a valid authored page destination or absolute HTTP(S) URL without credentials, whitespace or ambiguous authority syntax. The backend never fetches or proxies project URLs. Internal links follow page identities through path changes; remove or replace their references before deleting a linked page.

Only selecting a portfolio collection adds its backend, admin editor, migration, private image bucket, importer and verification module. Cards query current published records from the owner's database. There is no reserved /portfolio public route.

Services and Portfolio share authentication and bounded image/request helpers, with separate additive migrations and access policies. Existing Services tables are not rewritten. Both collections retain atomic revision checks and explicit publish/unpublish.

setup:content runs only selected importers in sequence. Services keeps content-seed.json; Portfolio uses portfolio-seed.json. Imports insert missing IDs without replacing deployed records. Source backups/seeds contain private drafts and must stay out of public directories and public repositories.

## Current limits

- 50 local portfolio records within the existing 10 MB project backup bound; exported admin supports 200 records.
- One Portfolio collection per authored page; different pages can use different designs over the same records.
- Stable ordering by record ID. Manual ordering, filtering, galleries and record-deletion UI are not implemented. Case-study layouts are authored pages, not automatically generated CMS detail pages.
- Bounded raster uploads and private owner storage. Old image cleanup is manual.
- Three system-font families; a bundled licensed font library remains future work.
- Owner deployment acceptance, provider email delivery, recovery UI, cloud accounts and independent production review remain outstanding.

See DESIGN-LIBRARY.md for actual design counts and PROGRESS.md for verified artifacts.
