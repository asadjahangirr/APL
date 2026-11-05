# Design-library delivery policy

Visual-library batches now accompany functional milestones. They are no longer deferred entirely to the final expansion phase.

The long-term requirement remains **100+ meaningful selectable options per component family**, plus complete website presets, themes, fonts and effects. This is a roadmap target, not the current count.

## Actual choices

Phase 1 of the dual-mode studio roadmap adds two complete, editable fictional-brand examples: Northline Studio (three pages, framed navigation, serif introduction, numbered services, contact) and Jordan Ellis (four pages, editorial sans-serif introduction, two original illustrated case studies, internal project links, contact). These are distinct complete site compositions with locally bundled original artwork; they do not inflate component-family recipe counts.

Phase 4 adds Atelier Meridian (five authored pages, Services and Articles CMS, contact) and Mira Sol (six authored pages, Portfolio and Articles CMS, two case studies, contact). Each has editable desktop/mobile homepage Design companions, original artwork and a reusable invitation. The controlled icon set has 14 symbols, including Home and Back. Copy code provides source and independent component bundles; it is not a shadcn CLI registry installer. Full-site templates, icons and color/motion combinations do not inflate the recipe counts below.

| Family | Implemented designs |
|---|---|
| Portfolio collection | 6: Gallery, Editorial, Split, Poster, Index, Framed |
| Services CMS collection | 4: Classic, Tiles, Bands, Spotlight |
| Articles CMS collection | 4: Journal, Covers, Reading list, Spotlight |
| Buttons inside layouts | 8: Solid, Outline, Soft, Editorial, Offset, Double frame, Arrow tab, Bracket |
| Hero | 6: Split, Statement, Centered, Editorial, Portrait, Inset |
| Shared header | 4: Classic, Centered, Framed, Editorial |
| Shared footer | 4: Classic, Columns, Editorial, Framed |
| Static Services/cards | 3: Classic, Bordered, Numbered rows; separate from Services CMS |
| Text section | 3: Classic, Editorial, Panel |

Index and Bands use one column. Other collection designs honor saved responsive columns. Classic preserves the previous Services layout.

Six palette presets: Studio, Editorial, Cobalt, Clay, Ink, Nocturne. Six custom color controls and three system-font families are available. Palette changes do not increase the design count.

Collections offer None, Gentle lift, Image zoom and Entrance reveal: three optional effects plus a disabled state. These are not additional designs. Reduced-motion preferences disable decorative animation and transforms; keyboard focus receives relevant hover feedback.

Heroes offer two entrance effects (Reveal and Image unveil), plus None. Buttons offer Lift, Moving arrow, Press and Surface sweep, plus None. Effects and shapes do not increase the design count.

## Growth and acceptance

Stable recipe IDs, shared renderers, validated variant settings, theme variables and scoped CSS keep designs maintainable. Different structure/behavior can justify a separate family; a new color does not.

Every recipe needs a real thumbnail, valid settings, responsive behavior, keyboard controls, reduced motion and matching independent export. Do not advertise a 100-design category until 100 distinct tested options exist.

Completed the current visual batch: four shared footers, three static Services sections, three Text sections, and four Articles collection designs. All use controlled recipe IDs and real-component thumbnails. Next: complete original templates and the component-copy workflow. The later linked-icon family needs clear destination controls and accessible labels. Rich scroll/3D effects need separate accessibility/performance work and remain optional.

## Reference research

Reviewed the official [Awwwards annual collection](https://www.awwwards.com/websites/sites_of_the_year/) and [CSS Design Awards annual nominees](https://www.cssdesignawards.com/woty2025/). Actual visual inspection used official showcase screenshots, not a live interaction audit:

- [We are Büro](https://www.cssdesignawards.com/woty2025/sites/we-are-buro): oversized typography, monochrome composition and prominent imagery informed the editorial direction.
- [Nite Riot](https://www.cssdesignawards.com/woty2025/sites/nite-riot): dominant imagery informed the poster direction. Our captions use a solid surface for readable contrast.
- [Merouane Bali](https://www.cssdesignawards.com/woty2025/sites/merouane-bali-portfolio): inspected its neon/3D direction and excluded it from the restrained default collection.

Layouts and code are original. No reference-site artwork, screenshot, source or font was copied into the product. Thumbnail image slots use typographic placeholders; owners provide their own images.

## Verification boundaries

The visual harness checked all ten collections at 360/820/1280 pixels (30 geometry checks), radio-keyboard selection and reduced motion. A separate actual-component audit passed 126 text-color checks across Studio, Ink and Nocturne, including contact inputs, preview warnings, image placeholders and contrast-section buttons; no 390px overflow was observed. Screenshots were reviewed. The editor journey checks design/theme persistence through reload/export and external destination navigation. These checks cover the tested fixtures and palettes, not every possible user composition or color.

This is not a full accessibility audit. Custom colors and user-created compositions need their own checks.

For the Articles/common-sections batch, a browser journey selected Numbered Services and Editorial footer designs, reloaded the project, and confirmed their preview output. It checked Articles draft/publication behavior and layout at 390, 768 and 1280 pixels. Export contract tests checked Text, Services and Footer recipe settings in generated site data and source. The Articles-only and combined full-stack exports passed isolated runtime checks. The new recipes still need broader keyboard, contrast and visual audits across all themes.

The composition batch also reviewed [Atoll Digital’s official 2025 award showcase](https://www.cssdesignawards.com/woty2025/sites/atoll-digital/): strong typography and divided layouts informed original header and hero recipes. This was visual reference research, not a claim to match its awards or a full live-site audit.
