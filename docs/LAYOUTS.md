# Nested layouts and preset column widths

The owner selected preset widths first. Dragging column dividers to custom sizes remains a later enhancement. The long-term requirement remains a large visual library, targeting 100+ meaningful designs across component families, plus reusable effects and complete site templates. This milestone establishes composition and a small initial style collection; it does not claim that library is complete.

## Try it

1. Open a project and choose **Add layout**. A section containing two columns appears after the existing page sections. Its first column has a heading, paragraph and button; its second contains an image placeholder.
2. Select **Outline** in the left sidebar. The **Page structure** tree lets you select nested elements, reorder siblings with arrows, and add elements or columns without dragging. Canvas dragging also uses allowed container types. Duplication remains disabled.
3. Select **Column group**. Choose widths independently for mobile, tablet and desktop. Presets are stacked, equal halves/thirds/quarters, 1:2, 2:1, 1:3 and 3:1.
4. Choose gaps between columns, spacing inside a column, and section padding. Blank tablet/desktop number fields inherit the previous screen. Width preset selectors have an explicit **Inherit** option that names the effective setting.
5. Select a heading, paragraph, image or button to change its content. Images support upload, accessible descriptions, proportions and corners. Buttons have a page/section destination, four visual designs, three shapes and three motion choices. Changes to a linked page's URL are resolved through its stable identity.
6. Preview all three widths, test navigation, then download and run that export's verifier. Contact behavior in the builder preview remains sample-only.

Responsive thresholds are mobile below 768px, tablet from 768px and desktop from 1024px. Presets arrange the existing columns; they never create/delete content. Four columns with the halves preset become two rows. Column order remains reading order. Separate top/center/stretch column alignment and top/center/bottom content positioning are available.

## Supported structure and bounds

- Page: existing ready-made Hero, Services, Text and Contact sections, plus new layout Sections.
- Section: Heading, Paragraph, Image, Button or a Columns group.
- Columns group: up to four Column containers.
- Column: Heading, Paragraph, Image or Button.

Sections and columns each allow up to 20 children. Projects retain the existing 50-page and 10 MB backup bounds, and now have a 1,000-component bound including layout containers and both shared records. These are local safety bounds, not cloud quotas or a one-project restriction. Empty containers can be saved while composing; they must be filled or removed before export. Image placeholders are allowed and visibly remain placeholders until a photograph is uploaded.

Nested column groups inside columns, arbitrary recursive containers, freeform positioning, divider dragging, external/script button actions, responsive font-size controls and independent per-device visibility are outside this slice. A button whose destination was removed must be assigned a valid destination before export; it is not silently redirected. Shared header/footer behavior is unchanged.

## Preservation, history and export

Schema version 3 stores nested `children` independently from editor-library slots. Read-only migrations accept validated version-one and version-two projects, preserve their content/IDs/settings, and convert them to the current format. A subsequent successful save writes version three. Older builder versions cannot reopen these backups; retain original backups if retaining old software.

Nested edits and tree reordering use the existing immutable undo history. Switching pages/projects, reloading, returning from preview or applying page/shared settings starts a new session. Page operations/shared settings remain outside canvas undo. Source before this change is preserved in `.local/checkpoints/before-nested-layouts-20260927`; browser projects are separate from that source checkpoint.

Each export includes only the selected component source plus necessary shared helpers, readable nested route JSX, local images and selected backend modules. User content remains serialized data. Unknown components/settings, unsupported nesting, duplicate IDs and invalid destinations cannot become executable source. Contact/admin functionality remains independent of the builder.

The adapter uses Puck's documented [slot fields](https://puckeditor.com/docs/api-reference/fields/slot) and [multi-column rendering](https://puckeditor.com/docs/integrating-puck/multi-column-layouts). The custom [outline override](https://puckeditor.com/docs/api-reference/overrides/outline) uses public state/actions and omits unused internal zones. Container renderers use the same classes and responsive helpers in editor, preview and generated websites. See PROGRESS.md for observed verification results.

## Growing toward 100+ designs

Component behavior, structural layout, visual recipe, theme tokens and motion remain separate concerns. A Button implementation handles link semantics; stable recipe IDs select solid, outline, soft or editorial presentation; shape and motion are independent settings. CSS handles the current effects, including hover/focus and reduced-motion preferences. No animation library or AI service is required for these controls.

The four button designs are counted as four designs. Changing a color, shape or animation does not turn them into 100 designs. Future library batches should add visually distinct thumbnail options, recipe metadata, responsive/accessibility checks and export tests. Structurally different families such as sidebar navigation and mega menus need their own controlled behavior; decorative variations should share implementations. Larger preset catalogs, bundled font choices and complete original templates remain separate upcoming work.

The next planned functional milestone is CMS content management, starting with an agreed collection and its listing/detail-page presentation. This layout release does not implement CMS, cloud accounts, commerce or a production deployment.
