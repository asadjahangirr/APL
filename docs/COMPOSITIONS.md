# Composition library batch
This is a bounded part of phase 2, not the complete 100+ design library.

## Working behavior
- Shared header: Classic, Centered, Framed, Editorial. All use actual page navigation, current-page indication, an optional action and a native keyboard-operable mobile menu.
- Hero: Split, Statement, Centered, Editorial, Portrait, Inset. Content and images are retained when switching layouts. No-image exports use a coherent text-only layout.
- Buttons: Solid, Outline, Soft, Editorial, Offset, Double frame, Arrow tab, Bracket. Each retains the configured page/section destination.
- Hero motion: None, Reveal, Image unveil. Button motion: None, Lift, Moving arrow, Press, Surface sweep. Reduced-motion CSS disables decorative movement.
- Radio selectors render the real components in inert thumbnails. Colors remain configurable through the existing six palettes and custom color controls.
- Schema v6 and generator 0.6.0. Frozen v5 validation and read-only migration preserve stored content and IDs. Missing new optional settings preserve the previous appearance. Older builders cannot read v6; keep original backups.
- Exported Header, Hero and Button source is identical to preview source. No new runtime dependencies.

## Try it
Run npm run dev, then open:
- http://127.0.0.1:5173/demos/design-library/ — compare actual components and themes.
- http://127.0.0.1:5173/demos/alex-morgan-multipage/full.html — Home, Work, About, Contact.

The four-page example is a separate validated backup at demos/alex-morgan-multipage/alex-morgan.apl.json. Import it through the builder to edit it. Existing browser projects and the original single-page demo were not replaced. The stand-alone demo maps links to a query parameter for local display; actual exports contain real Next.js /work, /about and /contact routes.

Contact actions in the browser demo are sample-only. Project cards point to fictional example.com destinations. The exported portfolio CMS, admin and contact inbox use the owner's configured backend.

## Verification and limits
111 unit tests include all catalog identities, migration safety, escaped authored text, page targets, editor round-trips and exact selective export source. The production build passes; its existing large editor-bundle warning remains.
Browser checks completed for all six heroes at 390, 768 and 1366px, and all four headers at 768px and mobile menus at 390px. The follow-up confirmed representative header/hero/button settings survive save/reload or reopening, and reviewed Home/Work/About/Contact at desktop, tablet and mobile widths. No horizontal overflow was observed in the reviewed samples. Contact preview explicitly reports no message was sent; mobile navigation and current-page Back to top work. [Review evidence](verification/compositions-browser-review.json). This is not an exhaustive combination or accessibility audit.

The contact/portfolio export passed 42 isolated runtime checks; the exact artifact hash and ZIP/source integrity are recorded in PROGRESS.md. Prior backend reports belong to their earlier artifact hashes, not automatically to this generator version.

## Next
Articles CMS using the established draft/publish workflow, accompanied by footer and section designs. Then two complete distinct starter templates, component copying and owner-host deployment acceptance. The four-page demo is not yet a selectable full template. Public cloud accounts, production email, commerce and 100+ designs per family remain later work.

## Review-only handoff
The owner requested review only. The connected-browser review is complete; no application-code changes or next-batch implementation were made. A clearly named local project, "Design review — disposable sample", remains available for inspection.
