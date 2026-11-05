# APL Design canvas

Choose **New project → Blank design canvas**, or open **Design** in any website project. Design and Build belong to the same APL project. Design edits stay independent from website pages. **Convert to website** provides a guided review before adding native Website content to Build. See [Phase 3 acceptance evidence](PHASE-3.md).

## Your first design

1. Add an artboard. Choose Desktop, Tablet, Mobile, Square, Presentation, or custom dimensions. An artboard is a screen or page for your visual design.
2. Add text, rectangles, ellipses, frames, or an uploaded PNG/JPEG/WebP. Select an object, drag it, resize with handles, or enter exact values in Properties. Double-click text to edit its words.
3. Use Layers to rename, select, hide, lock, and organize objects. Shift-click selects several. Group them to move together. Choose a frame/group in the parent control to nest an object. Frames clip their children; resizing a frame changes its clipping area while keeping the contents' sizes. Groups and multiple selections use proportional corner handles. Resizing a group scales its text with the artwork and detaches those text layers from their shared type style to preserve the scaled appearance.
4. Align objects, adjust their stacking order, and use snapping to line up edges and centers. Pan with the Hand tool, hold Space, or scroll. Zoom with buttons, the percentage menu, or Ctrl/Command + wheel. Fit all artboards brings the whole design back into view.
5. Save a color or type style from a selected object's Properties. Apply it to other objects; changing that style in the Styles panel updates its linked layers. Deleting a style preserves the objects' appearance.
6. Download an APL backup to keep editing on another browser/device. Download PNG artboards or a visual PDF to share your design.

On smaller screens, the Layers and Properties buttons open panels. Undo/Redo also have touch controls. Icons have descriptive names and tooltips, and the Canvas guide explains common actions. Keyboard users can select layers and edit Properties without operating the bitmap canvas directly.

## Shortcuts

| Action | Shortcut |
|---|---|
| Select / Hand | V / H, or hold Space |
| Text / Rectangle / Ellipse / Frame | T / R / O / F |
| Select all on current artboard | Ctrl/Command + A |
| Duplicate | Ctrl/Command + D |
| Group / Ungroup | Ctrl/Command + G / Shift + Ctrl/Command + G |
| Undo / Redo | Ctrl/Command + Z / Shift + Ctrl/Command + Z |
| Nudge / Larger nudge | Arrow keys / Shift + arrow keys |
| Delete selected layers | Delete or Backspace |
| Clear selection | Escape |
| Canvas guide | ? |

Shortcuts yield to text fields and open dialogs. Undo/Redo covers Design document edits in the current canvas session, including artboards, images, groups and styles. Reloading or switching modes starts a new undo session; the latest saved document remains.

## Downloads and recovery

APL backups preserve both documents, images, styles and conversion history. Import creates a separate project, so originals stay intact. PNG downloads omit editor controls and use the original artboard size or 2× resolution. Multiple PNG artboards download as a ZIP. A PDF contains one flattened image page per artboard, in document order, preserving proportions. PDF page dimensions use 72 points per inch for 96-pixel-per-inch artwork. PDF text is rasterized; the editable content remains in APL.

Projects save to IndexedDB on this device. Design, Build and conversion share one save queue; applying a conversion stages the complete envelope together. Failed edits stay available for recovery while the page remains open, and closing with pending/failed saves triggers the browser's close warning. Exact legacy Website records are archived separately before replacement; **Your projects → Download original websites** restores independent copies. Exact Phase 2 Studio8 envelopes are archived before their first Studio9 write. Phase 1's first-workspace snapshot remains separately available.

Clearing browser data removes local projects and browser-local recovery snapshots. Downloaded backups are the portable copy. Cloud accounts, synchronization and multiplayer are later phases.

The current limits are 24 artboards, 1,200 layers, 16 nested parents, 50 embedded images, 20 MB of Design data and 30 MB for the complete backup including conversion records. Up to 50 conversion records are retained. Edits and conversion candidates are checked against the complete backup limit before acceptance. Uploaded files must be PNG/JPEG/WebP under 2 MB and no more than 24 million pixels each, with 64 million pixels total per Design. Exported artboards must fit 16 million pixels and 8,192 pixels per side, including their resolution multiplier. A download must fit 64 million pixels across its artboards and 100 MB of encoded files. Oversized or undecodable exports show an error rather than omitting artwork. See [document contract](DOCUMENTS.md) for exact validation bounds.

## Turn a design into a website

1. Select an artboard and choose **Convert to website**. Confirm the page name, address, search details, navigation and shared header/footer choices.
2. Review the suggested sections. Confirm semantic roles and section/column reading order. Choose layouts and spacing for mobile, tablet and desktop; inherited values remain visible in the controls.
3. Confirm heading levels, meaningful image descriptions and each button's destination. Buttons can navigate to converted sections, existing pages, HTTP(S) websites, email addresses or phone numbers. Add a working contact form and, if needed, select the mockup layers it replaces. Its fields are name, email and message, with an independent exported submissions inbox.
4. Review every warning. Rotations, clipping, overlaps, omitted layers and absolute positioning can differ in semantic flow. Meaningful text stays editable; decorative artwork may become an image after approval. Unsupported or overlong content blocks preparation instead of being silently discarded.
5. Prepare the side-by-side comparison, inspect mobile, tablet and desktop, and approve before **Apply to Build**. The confirmed page uses native Website components. Design remains editable in its original form.

Later edits do not automatically update linked pages. In Build, choose **Compare conversions** to see whether Design, Website or both changed. Review the current Build page beside the proposal, then explicitly replace the previously converted sections or create a separate page. Replacement preserves unrelated authored sections, pages and CMS content. Existing page details stay unchanged unless you also approve applying the page settings from the review. If the source or owned target objects were deleted, the conversion is detached and a new page can preserve the remaining work.

If the project changes during an asynchronous review, Apply rejects the stale proposal and asks for a fresh comparison. Saving failures retain the complete conversion for a recovery backup. Preview contact submissions are simulated; the downloaded contact backend still requires the owner's configuration and independent verifier before deployment. Conversion creates Website content without adding APL hosting, an account or an AI service dependency.

## Visual references and original direction

The interface uses a central canvas with a layer rail and contextual properties, informed by [Penpot's interface tour](https://help.penpot.app/user-guide/first-steps/the-interface/). [Framer's canvas guide](https://www.framer.com/help/articles/how-to-use-the-canvas/) informed familiar zoom/pan behavior. [OpenDesign's Godly design analysis and prompt](https://opendesign.cc/en/sites/godly) informed restrained spacing and short interaction transitions. These are references; APL's interface and editable FORM / FIELD study are original implementations.

The canvas retains APL's warm paper and muted green identity, uses one family of [Phosphor icons](https://phosphoricons.com/), gives the user's artwork most of the workspace, and puts important actions into plain language. Controls use system sans-serif typography; editorial display typography is reserved for the blank-canvas introduction and the sample artwork. Motion is limited to short entrances, hover/state feedback and loading indicators. Reduced-motion settings disable it.

Original APL design brief used for this implementation:

> Create an approachable creative workspace with a spacious central canvas, a slim layer rail, and contextual properties. Use warm off-white surfaces, muted green selection states, fine borders, and readable system typography. Give each icon a clear action name. Keep artboards and their artwork visually dominant. Offer a welcoming empty state, useful screen presets, a simple guide, precise numeric controls, and direct download choices. Introduce panels and feedback with brief motion; respect reduced-motion preferences. On mobile, open layers and properties as temporary panels and keep editing, zoom, undo, and downloads reachable. Preserve website work in a separate Build document.

The implemented slice covers freeform composition, visual handoff and guided semantic conversion with real links and optional contact binding. The exact converted website passed independent contact persistence and admin-inbox checks with APL disconnected. Advanced vector tools, multiplayer, cloud accounts and commerce remain on the [roadmap](STUDIO-ROADMAP.md).
