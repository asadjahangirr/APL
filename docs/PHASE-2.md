# Phase 2: Freeform Design canvas

Completed and verified on 3 October 2026 against `STUDIO-ROADMAP.md`. Phase 2 adds a separate editable Design document to the working Website project. Guided Design-to-Build conversion remains Phase 3.

## Canvas and controls

The responsive workspace uses a central canvas, hierarchical Layers/Styles and contextual Properties, one family of labelled Phosphor icons, short state transitions and reduced-motion support. Beginners can start with screen presets, a blank canvas, the editable original FORM / FIELD study, or the Canvas guide. Mobile panels keep tools, zoom, downloads and undo reachable. The [canvas guide](DESIGN-CANVAS.md) includes controls, shortcuts, visual references and the original implementation brief.

Implemented editing covers artboards; frames/groups; rectangles, ellipses, images and text; selection and marquee; dragging, resizing and rotation; duplicate/delete/reorder; parent controls; hide/lock; alignment and snapping; pan/zoom/fit; reusable color/type styles; and bounded undo/redo. Frames resize their clipping area while preserving children. Groups resize proportionally, including typography, strokes and corner radii. Multi-selection drags and resizes commit once per gesture, so one undo restores the complete selection. Focusing an untouched numeric field preserves its full precision and type-style links.

PNG exports use the same scene as the canvas, excluding editor controls. Current/all-artboard and original/2× choices produce PNG or an ordered ZIP. PDF contains one proportional flattened page per artboard. APL backups retain editable layers, styles, images and both documents. Validation checks image headers before decoding and rejects excessive or corrupt exports with an explicit error.

## Data and preservation

The validated saved format is a v8 envelope containing the existing v7 Website document, a version 1 Design document and an empty conversions array. Existing Website components, semantic layouts, publication snapshots, paths and exports retain their contracts. The implemented contract and local bounds are in `DOCUMENTS.md`.

Legacy reads are pure. Opening old v1-v7 records does not rewrite IndexedDB. Before a subsequent v8 save replaces a legacy record, its exact raw original is archived once in the separate protection database. Failed archive writes prevent replacement. The first-workspace recovery snapshot from Phase 1 remains frozen, including any Design it captured. Both protections are browser-local; downloaded backups protect against browser-data clearing.

One storage queue handles Design and Build. Latest Design edits are staged before asynchronous persistence. Build changes preserve staged Design, and Design saves preserve the latest Website content even if the canvas callback holds stale props. Newer Design save timestamps are carried onto that latest Website facade. Quota failures retain the documents for recovery download and do not block later retries. A never-saved project can still produce a backup when the browser denies IndexedDB completely.

Imports and duplicates validate both documents, assign a new project ID, and attach the cloned Design before first save. Existing projects are unchanged. APL JSON/ZIP backups contain both documents and uploaded image data. Frozen recovery downloads use their captured envelope directly rather than combining an old Website with a newer cached Design.

## Website independence

Website source generation continues to render only semantic Website content. Downloads from Studio embed the complete v8 `project.apl.json` backup alongside the independent project, but Design text/images/editor modules do not enter public website data, assets or dependencies. Legacy export API callers retain v7 backups. File hashes and the content hash include whichever validated backup the input supplied. Each new source artifact remains verification-required.

## Repeatable validation

`tests/studio-document.test.ts` exercises v1-v7 immutable migration, byte-identical canonical v7 Website payloads, populated multi-artboard/style/image round trips, metadata/version rejection, broken references and cycles, strict refusal to replace unknown stored versions, raw-original archiving, simultaneous Design/Build writes, stale canvas callbacks, interrupted/quota-failed saves, complete IndexedDB denial, independent import/copy and frozen recovery Design.

`tests/export.test.ts` checks that a populated v8 Design remains in its private backup while every other runtime source/data/asset file matches a Website-only export. It also checks the complete ZIP manifest and content hash. Browser flows in `tests/studio-shell.spec.ts` now expect the v8 dual-document backup while retaining the existing Website editing, recovery and export journeys.

## Acceptance evidence

- **164 unit checks in 22 files passed** with `npm.cmd run test -- --maxWorkers=1`. This includes 18 persistence cases, real near-limit backup budgets, immutable migration, model/history operations and Website-only runtime generation. Test files now run serially by default to bound the maximum-size fixtures' memory pressure. Initial concurrent runs timed out under host load; the final serialized run passed without increasing assertion timeouts. See [unit log](../.artifacts/phase-2/unit-final.log).
- **37 browser journeys have passed across the combined run and scoped rechecks**: 19 existing Website/Studio journeys, nine real canvas journeys, five nested pointer cases, three renderer/export cases and one failed-module recovery case. The first combined run had 33 passes and two failures: an obsolete Phase 1 placeholder assertion and a navigation timeout. The updated mobile mode-switch check, complete canvas journeys and final single/multi-selection pointer rechecks passed. The new cold-module wait uses the same 30-second entry allowance as the other canvas journeys. See [combined log](../.artifacts/phase-2/browser-final.log), [UI rechecks](../.artifacts/phase-2/browser-recheck.log) and [mobile recheck](../.artifacts/phase-2/browser-mobile-recheck.log). The final two pointer cases and TypeScript check also exited successfully.
- **TypeScript and the production Vite build passed.** The final build transformed 780 modules with no chunk-size warning. Design UI is a lazy 315.83 kB chunk, with the 186.12 kB canvas engine separately cached and absent from initial HTML preloads. PDF loads on demand. See [build log](../.artifacts/phase-2/build-final.log).
- **Desktop/tablet/mobile layouts were checked at 1440, 768 and 390 pixels**, including empty/study states, touch panels, guide, website-to-canvas switching and zero horizontal overflow. The screenshots were visually inspected. See [desktop study](../.artifacts/phase-2/canvas-study-1440.png), [mobile study](../.artifacts/phase-2/canvas-study-390.png) and [mobile canvas](../.artifacts/phase-2/canvas-from-website-mobile.png). Browser checks inspect actual PNG pixels, ZIP dimensions/order and PDF page sizes, as well as complete editable restore/copy independence. This is targeted keyboard/responsive verification, not a complete assistive-technology audit.
- **A fresh populated v8 source export installs and builds independently.** `npm.cmd run export:fixture -- --static --design` generated a separate artifact, preserving earlier accepted exports. Cached offline installation added 52 packages; standalone Next.js compilation, TypeScript and static-page generation passed. Live `/`, `/about` and `/about/approach` returned 200; the private APL backup returned 404. All 49 manifest file hashes matched the 50-member ZIP and extracted files after build. Public source and built runtime contain no private Design-study markers or canvas dependencies. See [standalone proof](../.artifacts/phase-2/standalone-export-proof.json), [install log](../.artifacts/phase-2/standalone-offline-install.log) and [Next build log](../.artifacts/phase-2/standalone-next-build.log).

The standalone artifact is `.artifacts/phase-2-layout-static-export.zip`, SHA-256 `87c14c2a71b5d1ba6a359fe7dc8c3b3b004412765a884060a1f312f3e065ab17`, with manifest content hash `41fc71a88a662c02bbaf81638dea3e95ce96639f7e36d61453418a7b438e8b26`. Its private backup has two artboards, 24 Design layers and three Website pages. This validates that exact static artifact. Prior backend acceptance reports remain evidence for their own exact Phase 1 artifacts; this phase does not claim a new backend deployment proof for every future export.

The source checkpoint before canvas UI integration remains `.artifacts/phase-2/source-before-phase-2.zip`, SHA-256 `0e03d95bf68198d32a29fb30b5a28c6191eecba9fece40bd53071ee16a451cfb`. It preserves the existing uncommitted work at that checkpoint; earlier Phase 0 protection remains available too. The Phase 2 screenshot/download/source artifacts are local evidence and are not published to an external service.

## Remaining phases

Guided responsive conversion, explicit binding/link mapping, compare-and-update, reusable website components, copyable code, cloud identity/sync, commerce and broader drawing/motion remain the later roadmap. Freeform geometry does not automatically produce an accessible responsive website. PNG/PDF are visual exports; APL backups preserve editability.
