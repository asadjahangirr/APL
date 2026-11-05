# Multiple pages and shared site structure

The owner selected shared headers and footers for every page. This milestone extends the existing editor and independent exporter; it does not add customer-site hosting or a cloud dependency.

## Using it

1. Open or create a project. **Pages** lists its pages and controls navigation order.
2. Choose **Add page**, enter a name and URL, and create it. A simple editable hero provides initial content.
3. Use **Editing page** to switch between pages. Page title/search description and body sections belong to that page. Project name, colors and fonts belong to the whole site.
4. Open **Site header & footer** to change shared branding, footer text, visibility and the header action. Destinations are selected from real pages and sections.
5. Preview at mobile, tablet or desktop width. The mobile Menu disclosure works with keyboard or pointer. Navigation stays inside preview; forms remain explicitly simulated.
6. Download and run the generated verifier. Each page becomes a readable Next.js route with its own metadata.

URLs use lowercase letters, digits and hyphens, with up to four path segments. `/` stays the homepage. Duplicate paths, backend/asset paths, path traversal, URL query/fragment syntax, dynamic-route syntax and Windows device names are rejected. Hidden menu entries remain publicly addressable; hiding a page is not authorization.

The page list order controls menu order. Links reference stable page IDs internally and resolve to current paths during preview/export, so renaming a URL does not break internal navigation. Deletion requires confirmation; a shared action pointing to the removed page falls back to the homepage. Previously deployed URLs do not receive automatic redirects; owners need a new deployment and must manage redirects if needed.

The header and footer are fixed at the beginning and end of each page and edited separately from body blocks. Per-page header/footer overrides and global canvas undo for page operations are not implemented. Body pages now support [nested layouts](LAYOUTS.md): choose **Add layout**, then use **Outline** to add/select elements and reorder siblings. Column widths use responsive presets; custom divider dragging remains later work. Canvas undo includes nested changes within an editing session; changing page/project or applying page/shared settings resets that history. Backups remain the recovery mechanism for page/shared structural changes.

## Data and migration

The multiple-page milestone introduced schema version 2 with `pages[]` and `shared.header` / `shared.footer`. Current schema version 3 keeps those fields and adds validated nested `children` for layout containers. Pages hold stable IDs, names, paths, menu visibility, title/description and body nodes. Header/footer settings are stored once, including an enabled flag that preserves settings while hidden. Contact-module selection scans every page.

The frozen version-one and version-two schemas are preserved in `src/project/legacy-schema.ts` and `src/project/legacy-v2-schema.ts`. `readProject` validates each legacy format before migration and preserves project identity, theme, body content, component IDs and metadata. A version-one project receives one Home page; an absent old header/footer stays hidden. Version-two pages remain unchanged, with no automatic layout wrapping. Migration does not mutate its input. Storage reads are read-only; a successful subsequent save writes version 3. Old builder versions cannot read the new format, so retain original backups when keeping older software.

The source checkpoint from before the multiple-page milestone remains in `.local/checkpoints/before-multipage-20260927`. Source before nested layouts is in `.local/checkpoints/before-nested-layouts-20260927`. These exclude dependency/build folders and do not change browser projects.

The local prototype bounds projects to 50 pages, 1,000 components including containers and both shared records, and 10 MB for serialized backups including images. A page allows up to 60 body sections. The nested hierarchy separately allows up to 20 children per Section or Column and four Columns per group. These bounds are not a one-project limit or a measured cloud allocation policy.

## Independent export

The exporter validates the complete project and resolves selected components across all pages and nested children. It emits one file route per page, shared `SiteShell.tsx`, readable nested component JSX, serialized site/navigation data, assets, necessary layout helpers, module handlers/migrations where selected, and a locked dependency manifest. Authored text remains data; paths are validated before generating files. Removing contact from every page removes its backend and runtime dependencies. Empty body pages, empty layout containers, and broken shared-action or button destinations block export with a visible error.

The route layout and per-page metadata follow current primary documentation: [Next.js pages and layouts](https://nextjs.org/docs/app/getting-started/layouts-and-pages), [Next.js metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata). The existing [Puck component configuration](https://puckeditor.com/docs/api-reference/configuration/config) remains the editor adapter; canonical project data belongs to APL.

The isolated verifier visits every exported page at 390, 768 and 1280 pixels, checks page identity/metadata, verifies menu transitions and hidden entries, checks missing-route 404s, and runs the actual contact/admin scenarios even when contact is on a non-home page. See PROGRESS.md for observed results and the exact tested hashes. CMS editing, real owner email delivery and production hosting still require later work.
