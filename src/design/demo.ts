import { createArtboard, createLayer, designSchema, emptyDesign, type DesignDocument } from './schema';

/** Original editable study, deliberately separate from the project's website pages. */
export function editorialStudy(): DesignDocument {
  const desktop = createArtboard({ name: 'Studio / Desktop', width: 1200, height: 880, background: '#f7f4ec' });
  const mobile = createArtboard({ name: 'Studio / Mobile', x: 1320, width: 390, height: 844, background: '#f7f4ec' });
  const design = emptyDesign();
  design.artboards = [desktop, mobile];
  design.colors = [{ id: 'study-ink', name: 'Ink', value: '#263c31' }, { id: 'study-clay', name: 'Clay', value: '#c56945' }];
  design.typeStyles = [{ id: 'study-heading', name: 'Editorial heading', fontFamily: 'Georgia', fontSize: 76, fontWeight: 400, lineHeight: 1.12 }];
  const text = (board: string, name: string, words: string, x: number, y: number, width: number, height: number, fontSize: number, patch = {}) => createLayer('text', board, { name, text: words, x, y, width, height, fontSize, fill: '#263c31', colorStyleId: 'study-ink', ...patch });
  design.layers = [
    text(desktop.id, 'Wordmark', 'FORM / FIELD', 64, 38, 360, 30, 17, { fontWeight: 700 }),
    text(desktop.id, 'Edition', 'INDEPENDENT STUDIO     •     EST. 2026', 744, 42, 400, 24, 12),
    createLayer('rectangle', desktop.id, { name: 'Header rule', x: 64, y: 92, width: 1072, height: 1, fill: '#bcbeb3' }),
    text(desktop.id, 'Eyebrow', 'THOUGHTFUL BY DESIGN', 64, 166, 480, 24, 12, { fontWeight: 700 }),
    text(desktop.id, 'Editorial title', 'Room for\na different idea.', 60, 210, 670, 205, 76, { fontFamily: 'Georgia', typeStyleId: 'study-heading', lineHeight: 1.12 }),
    text(desktop.id, 'Introduction', 'We shape identities and digital spaces\nwith purpose, warmth, and a little curiosity.', 64, 446, 550, 85, 20, { lineHeight: 1.5 }),
    createLayer('frame', desktop.id, { id: 'study-artwork', name: 'Composition frame', x: 760, y: 160, width: 376, height: 430, fill: '#e5e3d7', radius: 0 }),
    createLayer('ellipse', desktop.id, { name: 'Clay sun', parentId: 'study-artwork', x: 829, y: 214, width: 238, height: 238, fill: '#c56945', colorStyleId: 'study-clay' }),
    createLayer('rectangle', desktop.id, { name: 'Olive block', parentId: 'study-artwork', x: 785, y: 350, width: 145, height: 270, fill: '#667660', rotation: -12 }),
    createLayer('rectangle', desktop.id, { name: 'Paper block', parentId: 'study-artwork', x: 922, y: 398, width: 175, height: 190, fill: '#f7f4ec', rotation: 14 }),
    createLayer('rectangle', desktop.id, { name: 'Clay action', x: 64, y: 562, width: 214, height: 56, fill: '#263c31', colorStyleId: 'study-ink', radius: 28 }),
    text(desktop.id, 'Action label', 'Explore our thinking  ↗', 80, 578, 180, 25, 15, { fill: '#ffffff', colorStyleId: null, textAlign: 'center' }),
    createLayer('rectangle', desktop.id, { name: 'Footer rule', x: 64, y: 710, width: 1072, height: 1, fill: '#bcbeb3' }),
    text(desktop.id, 'Discipline 01', '01 / BRAND IDENTITY', 64, 750, 300, 25, 14),
    text(desktop.id, 'Discipline 02', '02 / DIGITAL EXPERIENCES', 442, 750, 330, 25, 14),
    text(desktop.id, 'Discipline 03', '03 / CREATIVE DIRECTION', 810, 750, 330, 25, 14),
    text(mobile.id, 'Mobile wordmark', 'FORM / FIELD', 28, 30, 320, 24, 15, { fontWeight: 700 }),
    text(mobile.id, 'Mobile eyebrow', 'THOUGHTFUL BY DESIGN', 28, 112, 320, 20, 11, { fontWeight: 700 }),
    text(mobile.id, 'Mobile title', 'Room for a\ndifferent idea.', 26, 158, 340, 125, 46, { fontFamily: 'Georgia', lineHeight: 1.12 }),
    text(mobile.id, 'Mobile introduction', 'Identities and digital spaces,\nshaped with purpose and warmth.', 28, 309, 334, 60, 16, { lineHeight: 1.5 }),
    createLayer('rectangle', mobile.id, { name: 'Mobile artwork background', x: 28, y: 409, width: 334, height: 310, fill: '#e5e3d7' }),
    createLayer('ellipse', mobile.id, { name: 'Mobile clay sun', x: 95, y: 446, width: 205, height: 205, fill: '#c56945', colorStyleId: 'study-clay' }),
    createLayer('rectangle', mobile.id, { name: 'Mobile olive block', x: 56, y: 555, width: 128, height: 152, fill: '#667660', rotation: -9 }),
    text(mobile.id, 'Mobile footer', 'INDEPENDENT STUDIO / EST. 2026', 28, 775, 330, 22, 11),
  ];
  return designSchema.parse(design);
}
