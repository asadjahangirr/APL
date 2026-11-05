# Dual-mode document contract

The current Phase 4 contract uses Studio10, Website9 and unchanged Design1. Phase 3 used Studio9/Website8; its historical evidence remains in [PHASE-3.md](PHASE-3.md). Frozen Studio8 and Studio9 formats remain readable. Current acceptance and boundaries are recorded in [PHASE-4.md](PHASE-4.md).

```ts
type StudioProject = {
  schemaVersion: 10;
  id: string; // UUID; metadata must match website
  name: string;
  updatedAt: string;
  website: Project; // Website v9
  design: DesignDocument; // Design v1
  conversions: ConversionRecord[];
};

type DesignDocument = {
  version: 1;
  artboards: Artboard[];
  layers: DesignLayer[];
  assets: DesignAsset[];
  colors: ColorStyle[];
  typeStyles: TypeStyle[];
};
```

`src/project/studio-document.ts` validates the envelope, `src/project/schema.ts` validates Website, `src/design/schema.ts` validates Design, and `src/conversion/schema.ts` validates conversion plans and provenance. Unknown properties and versions reject. Envelope ID, name and update time must exactly match Website metadata. Conversion record IDs must be unique.

## Separate authored documents

Design artboard order controls document order; the flat layer array controls stacking. Layers reference an artboard and an optional frame/group parent. Coordinates share the artboard plane before inherited ancestor rotations, including grouped children. Moving a group transforms its descendants explicitly; grouping does not reinterpret coordinates. Supported kinds are frame, group, rectangle, ellipse, text and image. Uploaded assets are embedded PNG, JPEG or WebP data URLs. Reusable colors and type styles remain part of Design.

Design IDs are unique across artboards, layers, assets and styles. Validation rejects missing artboards, parents, assets or styles; cycles; cross-artboard parents; and parents that are not frames or groups. Only image layers reference assets, and only text layers reference type styles. Frames resize clipping bounds without scaling their children. Group resizing scales descendant typography and detaches a linked type style when necessary to preserve the scaled appearance.

Website contains semantic pages and native components, responsive layout presets, shared settings, theme and CMS publication snapshots. Website8 added authored appearance, stable anchors, validated actions and per-page shared chrome choices. Website9 adds up to 50 reusable section blueprints, materialized linked instances with revision/fingerprint/ID maps, icons, published-record actions, and portfolio page destinations. Reusable blueprint nodes count toward the 1,000-component bound. Publishing a reusable update preserves separately edited copies unless replacement is explicitly approved. Conversion copies confirmed content into Website; later Design changes leave Website content unchanged until explicitly applied.

## Conversion records and explicit updates

A version 1 conversion record stores its ID, algorithm version `1.0.0`, creation/update times, source artboard ID, target page/root IDs, source and target SHA-256 fingerprints, the confirmed version 1 plan, and acknowledged warning IDs. It contains no duplicate Design assets or historical source snapshot. The plan records page settings, section frames/order, column/item order, semantic roles, responsive layout/spacing/appearance, destinations and an optional contact binding.

Each connected conversion retains its latest approved mapping. Updating a connection replaces that record; previous mapping versions and conversion rollback are not retained. A separate-page conversion adds a new record.

The engine validates a draft, reports unsupported or simplified content, and requires acknowledgement of every warning before compilation. Meaningful text stays native: headings, paragraphs and button labels are never silently flattened or truncated. Images remain meaningful images with alternative text. Approved decorative artwork may become a local raster image; meaningful text inside that artwork blocks flattening. Absolute geometry becomes confirmed semantic flow. The wizard requires reviewing mobile, tablet and desktop output before approval.

Source fingerprints cover the selected artboard and its layers, referenced assets and reusable styles. Target fingerprints cover the generated roots, target page settings, theme and applicable shared header/footer. Comparison returns `current`, `design-changed`, `website-changed`, `both-changed` or `detached`. Missing source objects or target pages/roots produce a detached comparison rather than making the entire saved project unreadable. A new conversion still validates its actual source and destinations.

Updates require explicit approval. Replacing a linked conversion preserves unrelated Website roots, other pages, Design and CMS content. Edits inside owned converted roots require explicit overwrite confirmation; creating a separate page is the alternative. Existing page settings stay intact unless the separate page-settings checkbox is approved. The review also offers the current Build page for comparison before replacement. Normal Design and Build saves preserve provenance without automatically replacing either document.

## Local bounds

| Item | Validated limit |
|---|---|
| Website | 10 MB formatted JSON, 50 pages and 1,000 components including shared/layout records |
| Design | 20 MB compact JSON |
| Complete APL backup | 30 MB formatted JSON, including conversion records |
| Artboards / layers / parent depth | 24 / 1,200 / 16 |
| Design image assets | 50; each data URL at most 3,000,000 characters |
| Decoded Design images | 24 million pixels each; 64 million pixels total |
| Reusable colors / type styles | 100 of each |
| Design dimensions / positions | 1-12,000 / -100,000 to 100,000 design pixels |
| Conversion records | 50, with unique record IDs |
| One conversion plan | 30 sections, up to four columns per section, 20 items per column and 200 mapped layers total |
| Website text | Up to 4,000 characters for native component text; metadata has smaller limits. Longer Design text must be split deliberately |

These are local implementation bounds, not cloud quotas. A separately valid Website and Design may exceed the combined limit once formatted and wrapped. UI edits, history restoration and complete conversion/import candidates validate the combined envelope before entering staged state. Rejected candidates preserve the previous document and review revision.

Uploaded Design files must be PNG/JPEG/WebP under 2 MB. Image headers and dimensions are checked before decoding. Visual exports allow 16 million pixels per artboard, 8,192 pixels per side, 64 million pixels across a download and 100 MB of encoded output. Maximum artboard dimensions do not guarantee a raster export fits those limits. Fonts remain local Arial, Georgia, system UI and monospace.

## Migration and immutable recovery

`readStudioProject(input)` performs a pure, read-only migration. Studio10 round-trips both documents, reusable sections and conversion records. Frozen Studio8 and Studio9 are validated against their historical contracts, then migrate to Studio10/Website9 with identical Design and conversion data. Raw Website1–8 uses frozen migrations; raw Website9 is accepted. Earlier Websites receive an empty reusable library; raw Website imports receive an empty Design and no conversion records. Reading never changes the input or IndexedDB.

`legacy-v8-studio.ts` and `legacy-v9-studio.ts` freeze the earlier Studio envelopes. `legacy-v7-schema.ts` and `legacy-v8-schema.ts` freeze the earlier Websites. `legacy-migrate.ts` exports `readWebsiteProject()`; `migrate.ts` exposes `readProject()`, returning Website9 from supported Studio or Website inputs. `listProjects()` validates every stored record before caching or returning facades. Unknown future formats and invalid references preserve the originals.

Writes retain the project ID and `apl-studio` IndexedDB store. Exact original records are archived once before replacement: raw Websites under `before-design-canvas-v1:<id>`, Studio8 under `before-guided-conversion-v1:<id>`, and Studio9 under `before-reusable-components-v1:<id>`. Archives are never overwritten. Failed preservation stops replacement. The earlier immutable workspace snapshot remains available. Standard current backups preserve both documents and all content; the Studio9-specific archive reader is implemented internally but has no dedicated dashboard download button yet.

The **pre-conversion originals** download refers to that preserved Phase 2 Studio8 format before its first Studio9 write. It is not a snapshot before every conversion; newly created Studio9 projects have no Studio8 original.

`readProtection()` and `readMigrationProtection()` return validated current envelopes for the existing recovery flows. `readConversionProtection()` returns frozen Studio8 envelopes, suitable for original-format archive downloads without mixing in current cached Design. The independent `protection-store.ts` owns archive operations and prevents storage/protection circular imports.

## Staging and atomic persistence

Design, Build and conversion writes share one serialized queue. `saveProject(website)` preserves staged/saved Design and conversion records. `saveDesign(website, design)` preserves the latest Website content and carries a newer timestamp without copying stale canvas props over Build edits. Cold API calls resolve the stored companion documents before persistence and roll back rejected invalid stages. Quota or storage-access failures retain valid staged edits for recovery and do not block later retries.

The repository APIs are:

- `getStudioProject(website)`: compatibility backup behavior using the caller's Website facade and latest staged/saved Design and records.
- `getCurrentStudioProject(projectOrId)`: authoritative latest Website, Design and records for conversion review.
- `getStudioRevision(id)`: synchronous local mutation revision, changed by each accepted stage.
- `validateStudioProjectForStorage(candidate)`: pure validation of the full candidate and combined budget, retaining a newer known update time.
- `attachStudioProject(candidate)`: validate and synchronously stage all documents for an imported or duplicated project.
- `saveStudioProject(candidate, { revision })`: reject stale review state before mutation, stage the complete candidate together, and write one full envelope in one IndexedDB transaction.
- `getDesign(website)` and `attachDesign(id, design)`: Design-only compatibility helpers; full imports/duplicates use `attachStudioProject` to retain records.
- `hasPendingSaves()`: includes queued and active writes across projects and both modes.

The review revision guards changes in this browser tab. It is not multiplayer or cross-tab conflict synchronization. Backups can recover a complete staged candidate, including conversion fingerprints, when IndexedDB is denied entirely for a never-saved project. Frozen recovery snapshots use their stored values directly. Parsing and staging clone data; imported/duplicated projects receive a new project ID/name/update time while retaining independent internal document IDs and conversion references.

## Backups and independent source

APL JSON and workspace ZIP backups preserve Website, Design, conversion records and embedded assets. Each ZIP contains `<project-id>.apl.json` files and restore instructions. Clearing browser data removes projects and browser-local archives; downloaded backups remain the portable copies.

PNG/PDF downloads are flattened visual artifacts. The source exporter reads Website and selected backend bindings. The private `project.apl.json` carries the complete current envelope for Studio input; raw Website callers receive a validated current Website backup. Design-only text/assets and conversion editor code stay out of public runtime files. Content deliberately converted into Website is exported as ordinary native Website content, images and actions. No canvas library, APL login or APL service is required by the generated website.

The current manifest uses format version 8 and generator version `0.8.0`; its hashes include the full backup. Contact preview is simulated. Selecting an actual Website Contact component includes the independent contact backend/admin module. Generating its files does not establish backend verification: follow SETUP.md and run the owner-hosted verifier before deployment. Cloud synchronization, commerce, multiplayer, richer vectors and later roadmap phases remain outside this conversion slice.
