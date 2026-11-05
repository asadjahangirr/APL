import { createArtboard, createLayer, designSchema, emptyDesign, type DesignDocument, type DesignLayer } from './schema';
import meridianArtwork from '../studio/assets/phase4-meridian.webp?inline';
import meridianMaterial from '../studio/assets/phase4-material.webp?inline';
import lumenArtwork from '../studio/assets/phase4-lumen.webp?inline';
import tideArtwork from '../studio/assets/phase4-tide.webp?inline';

export type Phase4TemplateKind = 'meridian' | 'mira';

/** Editable home-page companions. Build contains the complete multi-page site;
 * these artboards stay independent until the user approves a conversion. */
export function createPhase4Design(kind: Phase4TemplateKind): DesignDocument {
  const business = kind === 'meridian';
  const design = emptyDesign();
  const ink = business ? '#2d302b' : '#20283e';
  const muted = business ? '#625e55' : '#515b74';
  const paper = business ? '#f6f2e9' : '#fffdf5';
  const accent = business ? '#8f472f' : '#254bd8';
  const surface = business ? '#e9e1d3' : '#eaf0ff';
  const title = business ? 'Room for\npossibility.' : 'Ideas, made\nvisible.';
  const brand = business ? 'ATELIER MERIDIAN' : 'MIRA SOL';
  const description = business
    ? 'Thoughtful spaces, identities, and digital experiences.\nMade to bring your next chapter into focus.'
    : 'I turn thoughtful ideas into expressive identities\nand useful digital experiences.';
  design.colors = [
    { id: kind + '-ink', name: 'Primary ink', value: ink },
    { id: kind + '-paper', name: 'Paper', value: paper },
    { id: kind + '-accent', name: business ? 'Copper' : 'Cobalt', value: accent },
  ];
  design.typeStyles = [
    { id: kind + '-body-style', name: 'Body / 18', fontFamily: 'Arial', fontSize: 18, fontWeight: 400, lineHeight: 1.5 },
    { id: kind + '-mobile-body-style', name: 'Mobile body / 16', fontFamily: 'Arial', fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
    { id: kind + '-caption-style', name: 'Caption / 13', fontFamily: 'Arial', fontSize: 13, fontWeight: 400, lineHeight: 1.4 },
  ];
  design.assets = [
    { id: kind + '-hero-art', name: business ? 'Meridian spatial illustration' : 'Lumen publication identity', dataUrl: business ? meridianArtwork : lumenArtwork, width: 1200, height: 1200 },
    { id: kind + '-second-art', name: business ? 'Meridian material illustration' : 'Tide Atlas editorial illustration', dataUrl: business ? meridianMaterial : tideArtwork, width: 1200, height: 1200 },
  ];

  const desktop = createArtboard({ id: kind + '-desktop', name: (business ? 'Atelier Meridian' : 'Mira Sol') + ' / Desktop home', width: 1440, height: business ? 2160 : 2560, background: paper });
  const mobile = createArtboard({ id: kind + '-mobile', name: (business ? 'Atelier Meridian' : 'Mira Sol') + ' / Mobile home', x: 1580, width: 390, height: business ? 2800 : 3100, background: paper });
  design.artboards = [desktop, mobile];
  for (const board of design.artboards) {
    const small = board.id === mobile.id;
    const prefix = board.id, pad = small ? 24 : 72, inner = board.width - pad * 2;
    const text = (id: string, name: string, words: string, parentId: string, x: number, y: number, width: number, height: number, patch: Partial<DesignLayer> = {}) => {
      const layer = createLayer('text', board.id, { id: prefix + '-' + id, name, text: words, parentId, x, y, width, height, fontFamily: 'Arial', fontSize: 18, lineHeight: 1.5, fill: ink, ...patch });
      if (layer.fill === ink) layer.colorStyleId = kind + '-ink';
      if (layer.fontFamily === 'Arial' && layer.fontWeight === 400 && layer.lineHeight === 1.5) {
        if (layer.fontSize === 18) layer.typeStyleId = kind + '-body-style';
        if (layer.fontSize === 16) layer.typeStyleId = kind + '-mobile-body-style';
      }
      design.layers.push(layer);
    };
    const frame = (id: string, name: string, y: number, height: number, fill = paper) => {
      const frameId = prefix + '-' + id;
      design.layers.push(createLayer('frame', board.id, { id: frameId, name, x: 0, y, width: board.width, height, fill }));
      return frameId;
    };
    const image = (id: string, name: string, assetId: string, parentId: string, x: number, y: number, width: number, height: number) => {
      design.layers.push(createLayer('image', board.id, { id: prefix + '-' + id, name, assetId, parentId, x, y, width, height, radius: business ? 0 : 8 }));
    };
    const action = (id: string, label: string, parentId: string, x: number, y: number, width = 176, secondary = false) => {
      const buttonId = prefix + '-' + id + '-frame';
      design.layers.push(createLayer('frame', board.id, { id: buttonId, name: label + ' / visual action', parentId, x, y, width, height: 50, fill: secondary ? paper : accent, stroke: secondary ? accent : 'transparent', strokeWidth: secondary ? 1 : 0, radius: business ? 0 : 6 }));
      text(id, 'Button / ' + label, label, buttonId, x + 18, y + 15, width - 36, 20, { fontSize: 14, fontWeight: 600, lineHeight: 1.3, fill: secondary ? accent : '#ffffff' });
    };

    const header = frame('header', 'Header / editable wordmark and navigation', 0, small ? 94 : 100);
    text('brand', 'Wordmark', brand, header, pad, small ? 28 : 37, inner, 24, { fontSize: business ? 17 : 21, fontWeight: 700, lineHeight: 1.2 });
    if (!small) text('navigation', 'Navigation reference / connect in Build', business ? 'Studio     Approach     Journal' : 'Work     About     Notes', header, 770, 40, 370, 20, { fontSize: 14, lineHeight: 1.2, textAlign: 'right' });

    const heroY = small ? 94 : 100, heroHeight = small ? 846 : 810;
    const hero = frame('hero', 'Introduction / responsive two-column study', heroY, heroHeight);
    text('intro-label', 'Studio descriptor', business ? 'A STUDIO FOR YOUR NEXT CHAPTER' : 'VISUAL DESIGNER / SYSTEMS AND STORIES', hero, pad, heroY + (small ? 30 : 66), small ? inner : 640, 20, { fontSize: 12, fontWeight: 600, lineHeight: 1.3, fill: accent });
    text('heading', 'Page heading / H1', title, hero, pad, heroY + (small ? 77 : 115), small ? inner : 635, small ? 128 : 218, { fontFamily: business ? 'Georgia' : 'Arial', fontSize: small ? 56 : business ? 90 : 102, fontWeight: business ? 400 : 700, lineHeight: 1.02 });
    text('description', 'Introduction', description, hero, pad, heroY + (small ? 232 : 370), small ? inner : 550, small ? 82 : 66, { fontSize: small ? 16 : 18, lineHeight: 1.5, fill: muted });
    action('start-project', 'Start project', hero, pad, heroY + (small ? 338 : 474), business ? 175 : 178);
    if (!small) text('reference-note', 'Home reference note', business ? 'LIGHT. MATERIAL. A CLEAR POINT OF VIEW.' : 'FICTIONAL PROJECTS. REAL DESIGN POSSIBILITIES.', hero, pad, heroY + 664, 640, 28, { fontSize: 12, fill: muted, lineHeight: 1.4 });
    image('hero-image', business ? 'Original Meridian spatial artwork' : 'Original Lumen identity artwork', kind + '-hero-art', hero, small ? pad : 768, heroY + (small ? 420 : 50), small ? inner : 600, small ? inner : 650);

    const workY = heroY + heroHeight, workHeight = small ? business ? 1100 : 1400 : business ? 670 : 1070;
    const work = frame('work', business ? 'Capabilities / CMS presentation reference' : 'Selected work / CMS presentation reference', workY, workHeight, surface);
    const workTitle = business ? 'Make a place\nfor better ideas.' : 'Selected work.\nA closer look.';
    text('work-heading', 'Section heading / H2', workTitle, work, pad, workY + (small ? 40 : 60), inner, small ? 90 : 120, { fontFamily: business ? 'Georgia' : 'Arial', fontSize: small ? 34 : 52, fontWeight: business ? 400 : 700, lineHeight: 1.1 });
    if (business) {
      const entries = [
        ['Space direction', 'A considered framework for how your\nspace feels, flows, and tells its story.'],
        ['Identity systems', 'A distinct visual language, shaped\naround the things that matter to you.'],
        ['Digital presence', 'Clear websites that connect your\nstory with the people it is for.'],
      ];
      const width = small ? inner : (inner - 80) / 3;
      entries.forEach(([heading, body], index) => {
        const x = small ? pad : pad + index * (width + 40), y = workY + (small ? 172 + index * 265 : 230);
        const group = prefix + '-service-' + index;
        design.layers.push(createLayer('group', board.id, { id: group, name: heading + ' / bind to Services in Build', parentId: work, x, y, width, height: 240 }));
        text('service-heading-' + index, 'Service heading / ' + heading, heading, group, x, y, width, 38, { fontFamily: 'Georgia', fontSize: 28, lineHeight: 1.2 });
        text('service-description-' + index, 'Service description / ' + heading, body, group, x, y + 64, width, 82, { fontSize: 16, fill: muted });
        action('service-action-' + index, 'Explore service', group, x, y + 174, 180, true);
      });
    } else {
      const width = small ? inner : (inner - 48) / 2;
      [['Lumen Press', 'Publication identity / Fictional project', 'hero-art'], ['Tide Atlas', 'Information design / Fictional project', 'second-art']].forEach(([heading, body, asset], index) => {
        const x = small ? pad : pad + index * (width + 48), y = workY + (small ? 168 + index * 598 : 230);
        const group = prefix + '-case-' + index;
        design.layers.push(createLayer('group', board.id, { id: group, name: heading + ' / bind to Portfolio in Build', parentId: work, x, y, width, height: small ? 566 : 690 }));
        image('case-image-' + index, 'Meaningful project image / ' + heading, kind + '-' + asset, group, x, y, width, width);
        text('case-heading-' + index, 'Case-study heading / ' + heading, heading, group, x, y + width + 24, width, 40, { fontSize: 28, fontWeight: 700, lineHeight: 1.2 });
        text('case-description-' + index, 'Case-study description / ' + heading, body, group, x, y + width + 79, width, 25, { fontSize: 13, fill: muted });
        action('case-action-' + index, 'View case study', group, x, y + width + 122, 186, true);
      });
    }

    const contactY = workY + workHeight, contact = frame('contact', 'Contact invitation / shared Website component reference', contactY, small ? 710 : 535);
    text('contact-heading', 'Contact heading / H2', business ? 'Let’s make room\nfor what comes next.' : 'Have a good idea?\nLet’s make it visible.', contact, pad, contactY + (small ? 48 : 74), small ? inner : 780, small ? 133 : 130, { fontFamily: business ? 'Georgia' : 'Arial', fontSize: small ? 40 : 56, fontWeight: business ? 400 : 700, lineHeight: 1.13 });
    text('contact-description', 'Contact invitation', business ? 'A new space, a fresh identity, or a website\nwith a clearer direction. Begin with a conversation.' : 'A new identity, a useful website, or a story\nthat deserves a different point of view.', contact, pad, contactY + (small ? 235 : 248), small ? inner : 780, 82, { fontSize: small ? 16 : 18, fill: muted });
    action('contact-action', 'Start project', contact, pad, contactY + (small ? 355 : 354), 175);
    text('example-note', 'Fictional example disclosure', 'An original, fictional APL example. Replace this story with your own.', contact, pad, contactY + (small ? 484 : 450), inner, 54, { fontSize: 12, fill: muted, lineHeight: 1.5 });
  }
  return designSchema.parse(design);
}
