# APL

A visual website designer where the design *is* the site. Every page is real HTML and CSS, so the canvas, Preview and the exported website all come from one renderer and look the same.

## Start

Use Node.js 24. On this machine npm's global cache points to the full E: drive, so use a temporary C: cache:

    npm ci --cache C:\Users\ASAD\AppData\Local\Temp\apl-npm-cache
    npm run dev

Open http://127.0.0.1:5173. Sites are saved in the browser (IndexedDB) as you work.

## What it does today

- **Editor:** frames, text, shapes, images, vectors (line, arrow, polygon, star, pen, pencil); auto layout with hug/fill/fixed; smart guides, snapping, grouping, align, undo/redo; command palette (Ctrl+K).
- **Responsive:** Desktop / Tablet / Phone views (Alt+1/2/3); edits on smaller screens are stored as overrides.
- **Library:** 163 layouts × 12 styles, with live thumbnails, full-size preview and copy-code (HTML + CSS or React).
- **Interactive site:** buttons are real `<button>`s, form fields are real `<input>`/`<textarea>`s. *Link → When clicked* can go to a page or web address, scroll to a layer, or show / hide a layer (menus, pop-ups, accordions).
- **Scrolling:** sticky layers (per screen size), scrollable frames and snapping carousels, and scroll effects (parallax, fade, slide, grow, blur, rotate, reveal) tied to the scroll position.
- **Style:** blend modes, cursors, text cut off after N lines.
- **Embeds:** YouTube/Vimeo videos, Google Maps and custom HTML/CSS/JS code (sandboxed).
- **Site features:** pages, components with instances, site colors with dark mode, motion (enter, loop, hover, scroll), version history (named and automatic, with restore).
- **Export:** a static website zip (one HTML file per page) with page transitions, favicon, social previews, canonical links, custom head code, `sitemap.xml` and `robots.txt`.

Not built yet: the backend half (data, logins, forms that send, stores, payments) and Supabase/Next.js export. See the roadmap in the project plan.

## Code map

- `src/doc`: the site document (schema, operations, components, colors, interactive upgrades).
- `src/render`: the shared renderer (HTML elements, CSS, motion). It may import only React and type-only schema.
- `src/canvas`: the editor UI, served at `/`.
- `src/library`: the design library (themes, builder kit, blocks).
- `templates`: Next.js / Supabase server modules (auth, CMS, contact) kept for the full-stack export batches.

## Checks

    npm test                                   # unit tests (run from PowerShell)
    $env:PW_CHANNEL='chrome'; npm run test:browser
    npm run build

The v1 studio (Konva canvas, Puck builder, guided conversion) was removed. It is preserved at git tag `v1-legacy`.
