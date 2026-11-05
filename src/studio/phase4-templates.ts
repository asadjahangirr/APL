import { projectSchema, type BodyNode, type ComponentProps, type LeafNode, type Project, type SitePage } from '../project/schema';
import type { ResponsiveAppearance } from '../project/appearance-schema';
import type { ArticlePayload } from '../project/article-schema';
import type { ServicePayload } from '../project/service-schema';
import type { PortfolioPayload } from '../project/portfolio-schema';
import { newProject } from '../project/templates';
import { createStudioProject, type StudioProject } from '../project/studio-document';
import { createPhase4Design, type Phase4TemplateKind } from '../design/phase4-templates';
import meridianArtwork from './assets/phase4-meridian.webp?inline';
import meridianMaterial from './assets/phase4-material.webp?inline';
import lumenArtwork from './assets/phase4-lumen.webp?inline';
import tideArtwork from './assets/phase4-tide.webp?inline';

export type { Phase4TemplateKind };
export const phase4TemplateDetails = [
  { id: 'meridian' as const, name: 'Atelier Meridian', category: 'Business / creative studio', description: 'A warm, architectural studio website with services, a journal, contact, and an editable Design companion.', pages: 5, image: meridianArtwork, modules: ['Contact', 'Services', 'Articles'] },
  { id: 'mira' as const, name: 'Mira Sol', category: 'Portfolio / visual designer', description: 'A bold, colorful portfolio with connected case studies, editable work and notes, and matching Design artboards.', pages: 6, image: lumenArtwork, modules: ['Contact', 'Portfolio', 'Articles'] },
];

const palettes = {
  meridian: { accent: '#8f472f', background: '#f6f2e9', surface: '#e9e1d3', ink: '#2d302b', muted: '#625e55', line: '#d5ccbd', font: 'serif' as const },
  mira: { accent: '#254bd8', background: '#fffdf5', surface: '#eaf0ff', ink: '#20283e', muted: '#515b74', line: '#d4dcf0', font: 'sans' as const },
};

/** Every factory call makes independent objects, IDs, CMS drafts and publications. */
export function createPhase4Website(kind: Phase4TemplateKind): Project {
  const business = kind === 'meridian';
  const project = newProject(business ? 'business' : 'portfolio');
  const palette = palettes[kind];
  const brand = business ? 'Atelier Meridian' : 'Mira Sol';
  const fontFamily = business ? 'Georgia' : 'Arial';
  const uid = () => crypto.randomUUID();
  const heading = (text: string, level: 'h1' | 'h2' | 'h3' = 'h2', override: ResponsiveAppearance = {}): LeafNode => ({ id: uid(), type: 'Heading', props: {
    text, level, size: level === 'h3' ? 'small' : 'large', align: 'left', appearance: {
      fontFamily: { mobile: fontFamily }, fontWeight: { mobile: business ? 400 : 700 },
      fontSize: level === 'h1' ? { mobile: 50, tablet: business ? 68 : 78, desktop: business ? 84 : 96 } : level === 'h3' ? { mobile: 25, desktop: 30 } : { mobile: 34, tablet: 44, desktop: 54 },
      lineHeight: { mobile: level === 'h1' ? 1.04 : 1.13 }, color: { mobile: palette.ink }, ...override,
    },
  } });
  const paragraph = (text: string, override: ResponsiveAppearance = {}): LeafNode => ({ id: uid(), type: 'Paragraph', props: { text, align: 'left', appearance: { fontFamily: { mobile: 'Arial' }, fontSize: { mobile: 16, desktop: 18 }, lineHeight: { mobile: 1.65 }, color: { mobile: palette.muted }, maxWidth: { mobile: 760 }, ...override } } });
  const label = (text: string): LeafNode => paragraph(text, { fontSize: { mobile: 12 }, fontWeight: { mobile: 600 }, lineHeight: { mobile: 1.4 }, color: { mobile: palette.accent } });
  const image = (data: string, alt: string, aspectRatio = 1): LeafNode => ({ id: uid(), type: 'Image', props: { image: data, alt, ratio: 'square', radius: business ? 'none' : 'soft', appearance: { aspectRatio: { mobile: aspectRatio }, radius: { mobile: business ? 0 : 8 } } } });
  const button = (text: string, pageId: string, anchor = '#top', secondary = false): LeafNode => ({ id: uid(), type: 'Button', props: {
    label: text, target: { pageId, anchor }, variant: secondary ? 'outline' : 'solid', shape: business ? 'square' : 'rounded', motion: 'arrow',
    appearance: { fontFamily: { mobile: 'Arial' }, fontSize: { mobile: 14 }, fontWeight: { mobile: 600 }, background: { mobile: secondary ? 'transparent' : palette.accent }, color: { mobile: secondary ? palette.accent : '#ffffff' }, borderColor: { mobile: palette.accent }, borderWidth: { mobile: 1 }, paddingX: { mobile: 22 }, paddingY: { mobile: 15 }, minHeight: { mobile: 50 }, radius: { mobile: business ? 0 : 6 } },
  } });
  const section = (children: Extract<BodyNode, { type: 'Section' }>['children'], options: { tone?: ComponentProps['Section']['tone']; gap?: number; id?: string; padding?: number } = {}): Extract<BodyNode, { type: 'Section' }> => ({ id: options.id ?? uid(), type: 'Section', props: {
    width: 'content', tone: options.tone ?? 'plain', padding: { mobile: 40, tablet: 56, desktop: options.padding ?? 76 },
    appearance: { paddingX: { mobile: 24, tablet: 40, desktop: 64 }, gap: { mobile: options.gap ?? 24, desktop: options.gap ?? 32 }, maxWidth: { mobile: 1296 } },
  }, children });
  const columns = (items: LeafNode[][], layout: ComponentProps['Columns']['layout'] = { mobile: 'stack', tablet: items.length === 3 ? 'thirds' : 'halves' }): Extract<Extract<BodyNode, { type: 'Section' }>['children'][number], { type: 'Columns' }> => ({ id: uid(), type: 'Columns', props: { layout, gap: { mobile: 32, tablet: 40, desktop: 56 }, align: 'center' }, children: items.map(children => ({ id: uid(), type: 'Column', props: { gap: { mobile: 24, desktop: 28 }, align: 'start' }, children })) });
  const page = (id: string, name: string, path: string, title: string, description: string, nodes: BodyNode[], inNavigation = true): SitePage => ({ id, name, path, title: title + ' | ' + brand, description, inNavigation, nodes });
  const invitation = (pageId: string): BodyNode => section([
    heading(business ? 'Let’s make room\nfor what comes next.' : 'Have a good idea?\nLet’s make it visible.'),
    paragraph(business ? 'A new space, a fresh identity, or a clearer website. Begin with a conversation.' : 'A new identity, a useful website, or a story with a different point of view.'),
    button('Start project', 'contact', '#contact'),
  ], { id: kind + '-' + pageId + '-invitation', tone: 'soft', gap: 28 });
  const published = <T extends ServicePayload | ArticlePayload | PortfolioPayload>(payload: T) => ({ id: uid(), draft: structuredClone(payload), published: structuredClone(payload), revision: 1, publishedRevision: 1 });
  const contact: BodyNode = { id: uid(), type: 'Contact', props: {
    title: business ? 'Tell us what you have in mind.' : 'Tell me what you have in mind.', description: 'Share your idea, a little context, and what a useful next step would look like.', button: 'Send message',
    appearance: { fontFamily: { mobile: fontFamily }, color: { mobile: palette.ink }, gap: { mobile: 28, desktop: 64 } },
    buttonAppearance: { background: { mobile: palette.accent }, color: { mobile: '#ffffff' }, fontFamily: { mobile: 'Arial' }, fontWeight: { mobile: 600 }, radius: { mobile: business ? 0 : 6 } },
    fieldAppearance: { background: { mobile: palette.background }, borderColor: { mobile: palette.line }, borderWidth: { mobile: 1 }, radius: { mobile: business ? 0 : 6 }, fontFamily: { mobile: 'Arial' }, fontSize: { mobile: 16 } },
  } };
  const collection = <K extends 'ServiceCollection' | 'ArticleCollection' | 'PortfolioCollection'>(type: K, props: ComponentProps[K]): Extract<BodyNode, { type: K }> => ({ id: uid(), type, props } as Extract<BodyNode, { type: K }>);

  project.name = brand + (business ? ' / studio website' : ' / portfolio');
  project.theme = { ...palette };
  project.shared.header.props = { brand, linkLabel: 'Start project', target: { pageId: 'contact', anchor: '#contact' }, design: business ? 'framed' : 'editorial' };
  project.shared.footer.props = { brand, note: 'An original, fictional APL example. Make this story your own.', design: business ? 'columns' : 'editorial' };

  if (business) {
    project.content.services = [
      published({ title: 'Space direction', slug: 'space-direction', summary: 'A considered framework for how your space feels, flows, and tells its story.', body: 'A place begins with the people who use it. We explore what they need to feel, find, and do, then turn that understanding into a focused visual direction.\n\nThis fictional service demonstrates a complete, editable CMS detail page. A real studio could describe its discovery workshops, spatial concepts, and collaboration with qualified local specialists here.\n\nA useful starting point includes a clear brief, reference materials, a material and color palette, and a practical plan for the next stage. Replace this example scope with your own offering before publishing.', image: meridianArtwork, imageAlt: 'Original isometric copper architectural model with open skylight and pale doorways' }),
      published({ title: 'Identity systems', slug: 'identity-systems', summary: 'A distinct visual language, shaped around the things that matter to your business.', body: 'A strong identity makes a clear idea recognizable. We begin by looking at your audience, purpose, and everyday communication, then build a visual language with room to evolve.\n\nThis fictional example describes an identity process: establish a direction, explore a focused range of concepts, develop the strongest system, and document how to use it consistently.\n\nA real offering might include naming support, a wordmark, typography, color, imagery guidance, and simple templates. Edit these details to reflect the work you actually provide.', image: meridianMaterial, imageAlt: 'Original nested copper, paper and charcoal material composition with a central sand-colored circle' }),
      published({ title: 'Digital presence', slug: 'digital-presence', summary: 'Clear websites that connect your story with the people it is for.', body: 'A useful website helps people understand your work and take the next step. Content, navigation, and a thoughtful mobile layout matter as much as its visual character.\n\nOur fictional process starts with the main journeys: discover the studio, explore its services, read a useful note, and begin a conversation. Each page has a clear purpose and an accessible reading order.\n\nThe editable APL example includes real page links, publication-ready CMS records, and an independently exportable contact module. Replace its content and configure your own services before deployment.', image: '', imageAlt: '' }),
    ];
    project.content.articles = [
      published({ title: 'Start with the feeling, then find the form', slug: 'start-with-the-feeling', summary: 'A useful design brief describes what people should experience before deciding what a place should look like.', body: 'A reference image can start a conversation, but it cannot do all the work of a brief. Before choosing finishes or drawing a mark, ask what people should feel, understand, and remember.\n\nWrite down three specific experiences. Perhaps an entrance should feel calm, a menu should be easy to read, or a website should make the next step obvious. These statements help compare ideas without reducing the discussion to personal taste.\n\nThen collect a small set of references for light, proportion, and rhythm. Explain the quality you are borrowing from each one. A focused explanation is more useful than a large mood board with no common direction.\n\nThis is an original article written for the fictional Atelier Meridian template. Replace it with your own studio notes, and use the CMS to manage draft and published versions independently.', image: meridianArtwork, imageAlt: 'Original copper spatial model used as a visual study of light and proportion' }),
      published({ title: 'A quieter palette can carry a stronger idea', slug: 'a-quieter-palette', summary: 'Restraint leaves room for material, proportion, and the small decisions that make a system feel considered.', body: 'A limited palette gives every choice more responsibility. The relationship between a warm paper surface, a dark line, and one clear accent can create a useful hierarchy without adding decoration to every part.\n\nTest the palette where people will use it. Check the contrast of small type. Look at photographs and illustrations beside it. Try the system on a phone, in a document, and in a simple email.\n\nThe goal is not to remove personality. It is to make the parts work together so that the content has space to lead.\n\nThis original fictional studio note demonstrates the editable Articles module. There are no client outcomes or performance claims in this example.', image: meridianMaterial, imageAlt: 'Original layered material study in copper, mineral paper and charcoal' }),
    ];
    const services = collection('ServiceCollection', { title: 'Make a place\nfor better ideas.', description: 'A clear direction, from your physical space to your digital presence.', mobile: 1, tablet: 2, desktop: 3, gap: 32, design: 'bands', motion: 'lift' });
    const journal = collection('ArticleCollection', { title: 'Notes from the studio.', description: 'Original thoughts on proportion, clarity, and the choices that make work useful.', mobile: 1, tablet: 2, desktop: 2, gap: 40, design: 'tiles', motion: 'lift' });
    project.pages = [
      page('home', 'Home', '/', 'Room for possibility', 'Thoughtful spaces, identities, and digital experiences for your next chapter.', [
        section([columns([[label('A STUDIO FOR YOUR NEXT CHAPTER'), heading('Room for\npossibility.', 'h1'), paragraph('Thoughtful spaces, identities, and digital experiences. Made to bring your next chapter into focus.'), button('Start project', 'contact', '#contact')], [image(meridianArtwork, 'Original copper architectural model with a skylight, imagined by APL')]], { mobile: 'stack', tablet: 'halves' })], { padding: 64 }),
        services,
        section([columns([[image(meridianMaterial, 'Original nested material illustration in copper, paper and charcoal')], [label('A CLEAR POINT OF VIEW'), heading('Good work begins\nwith understanding.'), paragraph('We bring a focused, collaborative approach to places and brands. The aim is simple: make your story clearer in the spaces where people meet it.'), button('Meet the studio', 'studio', '#top', true)]])], { tone: 'soft' }),
        { ...structuredClone(journal), id: uid() }, invitation('home'),
      ]),
      page('studio', 'Studio', '/studio', 'Small studio, thoughtful direction', 'An original fictional studio with a clear approach to spaces, identities, and websites.', [
        section([label('ATELIER MERIDIAN / THE STUDIO'), heading('Small studio.\nThoughtful direction.', 'h1'), paragraph('We look for the idea that belongs to you, then give it a clear and lasting form.')]),
        section([columns([[image(meridianArtwork, 'Original fictional spatial study in copper and mineral paper')], [heading('Built around\na better question.'), paragraph('What should your audience understand? What does your space need to make possible? Where does your story become unclear? A thoughtful question gives the work a more useful starting point.'), paragraph('Atelier Meridian is a fictional studio created for this APL template. Its service pages, journal and contact journey are complete examples that you can replace with your own experience and offering.')]])]),
        section([heading('A few things we believe.'), columns([[heading('Clarity is generous.', 'h3'), paragraph('Make it easier for people to find their way, understand an idea, and take the next step.')], [heading('Details work together.', 'h3'), paragraph('Light, language, type, and materials tell one story. Give each part a purpose.')], [heading('Good systems grow.', 'h3'), paragraph('Build a clear foundation with room for real content and future needs.')]], { mobile: 'stack', tablet: 'thirds' })], { tone: 'soft' }), invitation('studio'),
      ]),
      page('approach', 'Approach', '/approach', 'A clear direction, together', 'A practical studio process built around listening, exploration, and useful decisions.', [
        section([label('OUR APPROACH'), heading('A clear direction.\nMade together.', 'h1'), paragraph('Listen carefully. Explore purposefully. Make the details useful.')]),
        section([columns([[heading('Understand the context.', 'h2'), paragraph('Start with the audience, the ambition, and the conditions around the work. Agree what the project needs to make possible before choosing its visual direction.')], [heading('Explore a focused idea.', 'h2'), paragraph('Develop a small set of purposeful directions. Compare how each one answers the brief, then refine the strongest route together.')]])]),
        section([columns([[image(meridianMaterial, 'Original layered material study showing a focused copper and paper palette')], [heading('Make it work\nin the everyday.'), paragraph('Test the system with real content and real journeys. A website must read comfortably on a small screen; an identity must remain clear when the context changes.'), paragraph('This is an illustrative process for a fictional studio, not a promise of professional scope. Edit it to describe your actual services and working method.')]])], { tone: 'soft' }), invitation('approach'),
      ]),
      page('journal', 'Journal', '/journal', 'Notes from the studio', 'Original studio notes on clarity, materials, and a considered design process.', [section([label('THE JOURNAL'), heading('Ideas worth\nkeeping close.', 'h1'), paragraph('Original notes on the choices that make spaces, identities, and websites feel considered.')]), journal]),
      page('contact', 'Contact', '/contact', 'Start a thoughtful project', 'Share your idea and begin a conversation about your next chapter.', [section([label('START PROJECT'), heading('A good beginning\nis a conversation.', 'h1'), paragraph('Tell us where you are now, what you would like to change, and what a useful outcome looks like.')]), contact]),
    ];
  } else {
    project.content.portfolio = [
      published({ title: 'Lumen Press', summary: 'An expressive identity and reading-room concept for a fictional independent publication.', category: 'Publication identity', externalUrl: '', target: { pageId: 'lumen-press', anchor: '#top' }, image: lumenArtwork, imageAlt: 'Original cobalt Lumen poster with a modular cream L and saffron circle' }),
      published({ title: 'Tide Atlas', summary: 'A clear editorial system for a fictional publication about patterns, movement, and changing places.', category: 'Information design', externalUrl: '', target: { pageId: 'tide-atlas', anchor: '#top' }, image: tideArtwork, imageAlt: 'Original Tide Atlas poster with blue wave bands on cream and saffron paper' }),
    ];
    project.content.articles = [
      published({ title: 'Give the idea room to be itself', slug: 'give-the-idea-room', summary: 'A strong visual system starts with one recognizable idea and enough space for the content to lead.', body: 'When every element asks for attention, the main idea becomes harder to see. I like to begin with one recognizable relationship: a shape and a word, a clear rhythm, or an unexpected change in scale.\n\nThen I test that relationship with actual content. Can it support a long title? Does it still work in a small space? Does the hierarchy remain clear without an explanation?\n\nA useful system lets the content change while the direction stays recognizable. It is not a collection of perfect mockups; it is a way of making future decisions easier.\n\nThis original note is written for the fictional Mira Sol template. Its examples and projects are demonstrations, not client case studies.', image: lumenArtwork, imageAlt: 'Original Lumen Press graphic study using a cream L and saffron circle on cobalt' }),
      published({ title: 'Make the small screen part of the idea', slug: 'the-small-screen', summary: 'Responsive design is a way of choosing what matters, rather than shrinking a desktop composition.', body: 'A mobile layout changes the rhythm of a page. A two-column composition becomes a sequence. Images arrive at a different scale, and the next action needs to stay easy to find.\n\nI begin with a clear reading order and test how each section behaves as its width changes. The typography, spacing, and image crop can adapt without changing the core idea.\n\nFor a portfolio, the important journey is simple: understand the designer, find a project, read its story, and get in touch. Every screen should make those steps feel comfortable.\n\nThis fictional template demonstrates the same native website at mobile, tablet, and desktop sizes, alongside editable desktop and mobile Design artboards.', image: tideArtwork, imageAlt: 'Original Tide Atlas graphic study with repeated blue wave bands' }),
    ];
    const work = collection('PortfolioCollection', { title: 'Selected work.\nA closer look.', description: 'Two original fictional projects, with complete case-study pages and room for your own work.', mobile: 1, tablet: 2, desktop: 2, gap: 40, design: 'editorial', motion: 'lift' });
    const notes = collection('ArticleCollection', { title: 'A few things\non my mind.', description: 'Original notes on identity, useful systems, and designing for real screens.', mobile: 1, tablet: 2, desktop: 2, gap: 40, design: 'tiles', motion: 'lift' });
    const caseStudy = (id: 'lumen-press' | 'tide-atlas'): SitePage => {
      const lumen = id === 'lumen-press';
      return page(id, lumen ? 'Lumen Press' : 'Tide Atlas', '/work/' + id, lumen ? 'Lumen Press, an open reading room' : 'Tide Atlas, a system in motion', lumen ? 'An original fictional publication identity, built around a modular L, color, and a clear reading experience.' : 'An original fictional information-design study, built around patterns, waves, and readable editorial structure.', [
        section([label(lumen ? 'PUBLICATION IDENTITY / FICTIONAL PROJECT' : 'INFORMATION DESIGN / FICTIONAL PROJECT'), heading(lumen ? 'An open page.\nA brighter idea.' : 'A system\nin motion.', 'h1'), paragraph(lumen ? 'Lumen Press is an original identity and reading-room concept for an imagined independent publication.' : 'Tide Atlas is an original editorial system for an imagined publication about patterns and changing places.')]),
        section([image(lumen ? lumenArtwork : tideArtwork, lumen ? 'Original cobalt Lumen Press publication artwork with modular L and saffron circle' : 'Original Tide Atlas publication artwork with blue wave bands and saffron frame', 1.3)], { padding: 24 }),
        section([columns([[heading('The brief.'), paragraph(lumen ? 'Create a publication identity with a clear point of view and a comfortable reading experience. The system should be expressive enough for a cover and quiet enough for a long article.' : 'Make complex editorial material feel inviting. Use repetition and variation to connect stories without making every page look the same.')], [heading('The direction.'), paragraph(lumen ? 'A modular L provides the structure. A saffron circle introduces warmth and movement, while cobalt gives the identity a clear visual anchor.' : 'Wave bands become a flexible visual language. A simple type hierarchy and a warm paper surface give the information room to lead.')]])]),
        section([heading('A useful system,\nfrom cover to screen.'), paragraph(lumen ? 'The identity uses a limited set of shapes and a consistent reading order. Scale and crop create variation; the recognizable relationship between the L and circle keeps the system coherent.' : 'The graphic rhythm can adapt from a cover to a section divider or a digital thumbnail. On small screens, the composition becomes a clear sequence instead of a miniature desktop page.'), paragraph('This is an original fictional design study created for APL. It includes no client results, endorsements, or performance claims.'), button('View next project', lumen ? 'tide-atlas' : 'lumen-press', '#top', true)], { tone: 'soft' }), invitation(id),
      ], false);
    };
    project.pages = [
      page('home', 'Work', '/', 'Ideas made visible', 'Original identities and useful digital experiences by the fictional visual designer Mira Sol.', [
        section([columns([[label('VISUAL DESIGNER / SYSTEMS AND STORIES'), heading('Ideas, made\nvisible.', 'h1'), paragraph('I turn thoughtful ideas into expressive identities and useful digital experiences.'), button('Start project', 'contact', '#contact')], [image(lumenArtwork, 'Original cobalt Lumen poster with a cream L and saffron circle')]])], { padding: 64 }),
        work,
        section([columns([[label('A LITTLE ABOUT ME'), heading('A point of view.\nRoom to explore.'), paragraph('I like clear ideas, expressive systems, and the small details that make a digital experience feel considered. This fictional portfolio shows a complete starting point for your own work.'), button('More about Mira', 'about', '#top', true)], [image(tideArtwork, 'Original Tide Atlas design study with blue wave bands')]])], { tone: 'soft' }),
        { ...structuredClone(notes), id: uid() }, invitation('home'),
      ]),
      caseStudy('lumen-press'), caseStudy('tide-atlas'),
      page('about', 'About', '/about', 'A thoughtful eye, a clear idea', 'The point of view behind an original fictional visual-design portfolio.', [
        section([label('ABOUT MIRA'), heading('A thoughtful eye.\nA clear idea.', 'h1'), paragraph('Identity, editorial design, and useful digital experiences. Built around a point of view that belongs to the project.')]),
        section([columns([[image(tideArtwork, 'Original Tide Atlas editorial artwork in blue, cream and saffron')], [heading('Curious about\nwhat comes next.'), paragraph('I work at the meeting point of visual character and practical use. A recognizable identity matters, but so does the way its content reads, moves, and helps someone take the next step.'), paragraph('Mira Sol is a fictional designer created for this APL template. The projects, notes, and artwork are original examples. Replace this introduction with your own story and professional experience.')]])]),
        section([columns([[heading('Find the idea.', 'h3'), paragraph('Start with the audience and the purpose. Look for a clear relationship that can guide the work.')], [heading('Build the system.', 'h3'), paragraph('Give the idea a useful vocabulary of type, color, imagery, and layout. Test it with real content.')], [heading('Consider the details.', 'h3'), paragraph('Make the small screen, the reading order, and the next action part of the design from the beginning.')]], { mobile: 'stack', tablet: 'thirds' })], { tone: 'soft' }), invitation('about'),
      ]),
      page('notes', 'Notes', '/notes', 'Notes on making ideas visible', 'Original notes on visual systems, responsive design, and thoughtful digital experiences.', [section([label('NOTES'), heading('Ideas in\nthe making.', 'h1'), paragraph('A few original thoughts on the choices that make design expressive and useful.')]), notes]),
      page('contact', 'Contact', '/contact', 'Start a design project', 'Share a good idea and begin a conversation about making it visible.', [section([label('START PROJECT'), heading('Have a good idea?\nLet’s talk.', 'h1'), paragraph('An identity, a website, or an early question. Tell me a little about what you are making.')]), contact]),
    ];
  }
  return projectSchema.parse(project);
}

export function createPhase4Template(kind: Phase4TemplateKind): StudioProject {
  return createStudioProject(createPhase4Website(kind), createPhase4Design(kind));
}

/** Actual creation seeds a reusable invitation and links materialized copies.
 * Previews use the synchronous factories and never stage or save a project. */
export async function preparePhase4Template(kind: Phase4TemplateKind): Promise<StudioProject> {
  const studio = createPhase4Template(kind);
  const { saveReusableComponent, insertReusableComponent } = await import('../project/reusable');
  const saved = await saveReusableComponent(studio.website, 'home', kind + '-home-invitation', 'Start project invitation');
  let website = saved.project;
  const targetPages = kind === 'meridian' ? ['studio', 'approach'] : ['about', 'lumen-press', 'tide-atlas'];
  for (const pageId of targetPages) {
    const index = website.pages.find(page => page.id === pageId)!.nodes.findIndex(node => node.id === kind + '-' + pageId + '-invitation');
    // Replace only the factory's ordinary invitation with the linked instance.
    website = { ...website, pages: website.pages.map(page => page.id === pageId ? { ...page, nodes: page.nodes.filter((_, nodeIndex) => nodeIndex !== index) } : page) };
    website = await insertReusableComponent(website, saved.componentId, pageId, index);
  }
  return createStudioProject(website, studio.design, studio.conversions);
}
