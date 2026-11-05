import { createArtboard, createLayer, designSchema, emptyDesign, type DesignDocument, type DesignLayer } from '../design/schema';
import type { Project } from '../project/schema';
import { suggestConversionPlan } from './engine';
import type { ConversionPlan } from './schema';

const paper = '#f7f5ed', ink = '#263c31', clay = '#b56b48', muted = '#58655c', line = '#cbd2c4';
const introduction = 'Brand identities and useful websites,\nshaped with care and a clear direction.';
const contactDescription = 'Tell us about your idea. We will get back\nto you with a thoughtful next step.';

/** Original, editable business-page study designed around the supported semantic grammar. */
export function businessDesign(): DesignDocument {
  const design = emptyDesign();
  const desktop = createArtboard({ id: 'business-desktop', name: 'Field & Form / Desktop', width: 1440, height: 1160, background: paper });
  const mobile = createArtboard({ id: 'business-mobile', name: 'Field & Form / Mobile', x: 1560, width: 390, height: 1610, background: paper });
  design.artboards = [desktop, mobile];
  design.colors = [{ id: 'business-ink', name: 'Field ink', value: ink }, { id: 'business-paper', name: 'Warm paper', value: paper }, { id: 'business-clay', name: 'Clay', value: clay }];
  const text = (boardId: string, id: string, name: string, words: string, parentId: string, x: number, y: number, width: number, height: number, patch: Partial<DesignLayer> = {}) => createLayer('text', boardId, { id, name, text: words, parentId, x, y, width, height, fontFamily: 'Arial', fontSize: 16, lineHeight: 1.5, fill: ink, ...patch });
  for (const board of design.artboards) {
    const small = board.id === mobile.id, prefix = small ? 'mobile' : 'desktop', pad = small ? 24 : 64, inner = board.width - pad * 2;
    const headerHeight = small ? 108 : 72, heroHeight = small ? 460 : 400, servicesHeight = small ? 382 : 184;
    const headerId = prefix + '-header', heroId = prefix + '-hero', servicesId = prefix + '-services', contactId = prefix + '-contact';
    design.layers.push(createLayer('frame', board.id, { id: headerId, name: '01 / Identity', x: 0, y: 0, width: board.width, height: headerHeight, fill: paper }));
    const headerColumn = small ? inner : (inner - 40) / 2;
    for (let index = 0; index < 2; index++) {
      const group = prefix + '-header-column-' + index, x = small ? pad : pad + index * (headerColumn + 40), y = small ? 24 + index * 43 : 24;
      design.layers.push(createLayer('group', board.id, { id: group, name: index ? 'Studio note' : 'Wordmark', parentId: headerId, x, y, width: headerColumn, height: 22 }));
      design.layers.push(text(board.id, prefix + (index ? '-edition' : '-brand'), index ? 'Studio note' : 'Wordmark', index ? 'INDEPENDENT DESIGN / EST. 2026' : 'FIELD / FORM', group, x, y, headerColumn, 22, { fontSize: index ? 12 : 16, fontWeight: index ? 400 : 700, lineHeight: 1.2, fill: index ? muted : ink }));
    }

    const heroY = headerHeight, columnWidth = small ? inner : (inner - 40) / 2, leftId = prefix + '-hero-copy';
    design.layers.push(createLayer('frame', board.id, { id: heroId, name: '02 / Introduction', x: 0, y: heroY, width: board.width, height: heroHeight, fill: paper }));
    const top = heroY + (small ? 24 : 40), titleHeight = small ? 88 : 106, bodyHeight = small ? 48 : 54, gap = small ? 16 : 24;
    design.layers.push(createLayer('group', board.id, { id: leftId, name: 'Story column', parentId: heroId, x: pad, y: top, width: columnWidth, height: titleHeight + bodyHeight + gap * 2 + 48 }));
    design.layers.push(text(board.id, prefix + '-headline', 'Page heading', 'Make room\nfor better work.', leftId, pad, top, columnWidth, titleHeight, { fontFamily: 'Georgia', fontSize: small ? 40 : 48, lineHeight: 1.1 }));
    design.layers.push(text(board.id, prefix + '-intro', 'Introduction', introduction, leftId, pad, top + titleHeight + gap, columnWidth, bodyHeight, { fontSize: small ? 16 : 18, lineHeight: 1.5, fill: muted }));
    const actionY = top + titleHeight + gap + bodyHeight + gap, actionId = prefix + '-action-frame';
    design.layers.push(createLayer('frame', board.id, { id: actionId, name: 'Contact action', parentId: leftId, x: pad, y: actionY, width: 204, height: 48, fill: ink, radius: 6 }));
    design.layers.push(text(board.id, prefix + '-action', 'Button label', 'Start a conversation', actionId, pad + 16, actionY + 14, 174, 20, { fontSize: 16, fontWeight: 600, lineHeight: 1.2, fill: '#ffffff' }));
    const artworkId = prefix + '-artwork', artHeight = columnWidth / (636 / 320), artX = small ? pad : pad + columnWidth + 40, artY = small ? actionY + 48 + 24 : top;
    design.layers.push(createLayer('frame', board.id, { id: artworkId, name: 'Decorative studio composition', parentId: heroId, x: artX, y: artY, width: columnWidth, height: artHeight, fill: '#e6e7dc', radius: 8 }));
    const scale = columnWidth / 636;
    design.layers.push(createLayer('ellipse', board.id, { id: prefix + '-sun', name: 'Clay circle', parentId: artworkId, x: artX + 52 * scale, y: artY + 44 * scale, width: 216 * scale, height: 216 * scale, fill: clay }));
    design.layers.push(createLayer('rectangle', board.id, { id: prefix + '-green-shape', name: 'Green plane', parentId: artworkId, x: artX + 322 * scale, y: artY + 104 * scale, width: 350 * scale, height: 236 * scale, rotation: -12, fill: '#71846c' }));
    design.layers.push(createLayer('rectangle', board.id, { id: prefix + '-paper-shape', name: 'Paper plane', parentId: artworkId, x: artX + 252 * scale, y: artY + 152 * scale, width: 216 * scale, height: 154 * scale, rotation: 10, fill: '#fcfbf5' }));

    const servicesY = heroY + heroHeight;
    design.layers.push(createLayer('frame', board.id, { id: servicesId, name: '03 / What we do', x: 0, y: servicesY, width: board.width, height: servicesHeight, fill: '#fffdf8' }));
    const services = [
      { title: 'A clear identity.', body: 'Positioning and visual systems,\nmade clear and memorable.' },
      { title: 'A useful website.', body: 'Thoughtful digital experiences,\nbuilt around real people.' },
      { title: 'A lasting direction.', body: 'Practical guidance for teams,\nwith room for what comes next.' },
    ];
    const serviceWidth = small ? inner : (inner - 80) / 3;
    for (const [index, service] of services.entries()) {
      const group = prefix + '-service-column-' + index, x = small ? pad : pad + index * (serviceWidth + 40), y = servicesY + (small ? 24 + index * 119.2 : 40);
      design.layers.push(createLayer('group', board.id, { id: group, name: 'Service ' + (index + 1), parentId: servicesId, x, y, width: serviceWidth, height: 103.2 }));
      design.layers.push(text(board.id, prefix + '-service-heading-' + index, 'Service heading ' + (index + 1), service.title, group, x, y, serviceWidth, 31.2, { fontFamily: 'Georgia', fontSize: 26, lineHeight: 1.2 }));
      design.layers.push(text(board.id, prefix + '-service-body-' + index, 'Service description ' + (index + 1), service.body, group, x, y + 31.2 + (small ? 16 : 24), serviceWidth, 48, { fontSize: 16, lineHeight: 1.5, fill: muted }));
    }

    const contactY = servicesY + servicesHeight, contactTop = contactY + (small ? 32 : 40), formWidth = small ? inner : (inner - 60) / 2;
    design.layers.push(createLayer('frame', board.id, { id: contactId, name: '04 / Contact form', x: 0, y: contactY, width: board.width, height: small ? 650 : 500, fill: paper }));
    const infoId = prefix + '-contact-info', titleHeightContact = small ? 64.4 : 101.2;
    design.layers.push(createLayer('group', board.id, { id: infoId, name: 'Contact introduction', parentId: contactId, x: pad, y: contactTop, width: formWidth, height: titleHeightContact + 18 + 52.8 }));
    design.layers.push(text(board.id, prefix + '-contact-heading', 'Contact heading', "Let's make\nsomething useful.", infoId, pad, contactTop, formWidth, titleHeightContact, { fontSize: small ? 28 : 44, fontWeight: 500, lineHeight: 1.15 }));
    design.layers.push(text(board.id, prefix + '-contact-description', 'Contact description', contactDescription, infoId, pad, contactTop + titleHeightContact + 18, formWidth, 52.8, { fontSize: 16, lineHeight: 1.65, fill: muted }));
    const formId = prefix + '-form', formX = small ? pad : pad + formWidth + 60, formY = small ? contactTop + titleHeightContact + 18 + 52.8 + 28 : contactTop;
    design.layers.push(createLayer('group', board.id, { id: formId, name: 'Form fields / bind in conversion', parentId: contactId, x: formX, y: formY, width: formWidth, height: 414 }));
    for (const [index, label] of ['Your name', 'Email address', 'What are you working on?'].entries()) {
      const y = formY + index * 88;
      design.layers.push(text(board.id, prefix + '-field-label-' + index, 'Form label / ' + label, label, formId, formX, y, formWidth, 16, { fontSize: 13, fontWeight: 600, lineHeight: 1.2 }));
      design.layers.push(createLayer('rectangle', board.id, { id: prefix + '-field-' + index, name: 'Visual form field ' + (index + 1), parentId: formId, x: formX, y: y + 24, width: formWidth, height: index === 2 ? 104 : 46, fill: '#ffffff', stroke: line, strokeWidth: 1, radius: 4 }));
    }
    const submitY = formY + 322;
    design.layers.push(createLayer('rectangle', board.id, { id: prefix + '-submit-background', name: 'Visual submit control', parentId: formId, x: formX, y: submitY, width: formWidth, height: 50, fill: ink, radius: 4 }));
    design.layers.push(text(board.id, prefix + '-submit-label', 'Submit button label', 'Send message', formId, formX + 20, submitY + 15, formWidth - 40, 20, { fontSize: 16, fontWeight: 600, lineHeight: 1.2, fill: '#ffffff' }));
  }
  return designSchema.parse(design);
}

/** An explicit suggested approval plan for the original demonstration, not a hidden conversion. */
export function businessConversionPlan(design: DesignDocument, website: Project): ConversionPlan {
  const board = design.artboards.find(board => board.id === 'business-desktop') ?? design.artboards[0];
  const plan = suggestConversionPlan(design, board.id, website);
  plan.page.name = 'Field & Form'; plan.page.title = 'Field & Form / Thoughtful design';
  plan.page.description = 'An independent studio for clear identities and useful websites.';
  for (const section of plan.sections) {
    const contact = section.frameId === 'desktop-contact';
    const header = section.frameId === 'desktop-header';
    section.paddingX = { mobile: 24, tablet: 40, desktop: 64 };
    section.paddingY = { mobile: contact ? 32 : 24, tablet: header ? 24 : 32, desktop: header ? 24 : 40 };
    section.gap = { mobile: 24, tablet: 32, desktop: 40 };
    section.contentGap = { mobile: 16, tablet: 20, desktop: 24 };
    for (const column of section.columns) for (const item of column.items) {
      const layer = design.layers.find(layer => layer.id === item.layerId)!;
      if (contact) { item.role = 'ignore'; continue; }
      if (/Service heading/.test(layer.name)) { item.role = 'heading'; item.level = 'h2'; }
      if (layer.id === 'desktop-intro') item.appearance = { ...item.appearance, fontSize: { mobile: 16, tablet: 18, desktop: 18 } };
      if (layer.id === 'desktop-action') {
        item.role = 'button'; item.destination = { kind: 'section', sectionId: 'contact' };
        item.appearance = { ...item.appearance, background: { mobile: ink }, color: { mobile: '#ffffff' }, fontSize: { mobile: 16 }, fontWeight: { mobile: 600 }, radius: { mobile: 6 }, paddingX: { mobile: 16 }, paddingY: { mobile: 14 }, maxWidth: { mobile: 220 }, minHeight: { mobile: 48 } };
      }
    }
  }
  plan.contact = { sourceLayerIds: ['desktop-contact'], title: "Let's make\nsomething useful.", description: contactDescription, button: 'Send message', appearance: { gap: { mobile: 28, tablet: 60, desktop: 60 } }, buttonAppearance: { background: { mobile: ink }, color: { mobile: '#ffffff' }, fontFamily: { mobile: 'Arial' }, fontSize: { mobile: 16 }, fontWeight: { mobile: 600 }, radius: { mobile: 4 }, paddingX: { mobile: 20 }, paddingY: { mobile: 15 } }, fieldAppearance: { background: { mobile: '#ffffff' }, borderColor: { mobile: line }, borderWidth: { mobile: 1 }, radius: { mobile: 4 }, fontFamily: { mobile: 'Arial' }, fontSize: { mobile: 16 }, paddingX: { mobile: 12 }, paddingY: { mobile: 12 } } };
  return plan;
}
