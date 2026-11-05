import { projectSchema, type Project, type SiteNode } from './schema';
export function newProject(kind: 'business' | 'portfolio' = 'business'): Project {
  const portfolio = kind === 'portfolio';
  const nodes: SiteNode[] = [
    { id: crypto.randomUUID(), type: 'Header', props: { brand: portfolio ? 'Jordan Ellis' : 'Northline Studio', linkLabel: 'Get in touch', target: { pageId: 'home', anchor: '#contact' } } },
    { id: crypto.randomUUID(), type: 'Hero', props: { eyebrow: portfolio ? 'Independent designer & maker' : 'A small studio with a considered approach', title: portfolio ? 'Thoughtful work.\nLasting impressions.' : 'Good ideas deserve\na clear direction.', description: portfolio ? 'I turn complex ideas into useful, expressive digital experiences.' : 'We help ambitious businesses find their voice and build a presence that feels like them.', image: '', imageAlt: '', layout: 'split' } },
    { id: crypto.randomUUID(), type: 'Services', props: { title: portfolio ? 'Selected capabilities' : 'A little clarity goes a long way.', description: 'From the first conversation to the final detail.', mobile: 1, tablet: 2, desktop: 3, gap: 24, items: [
      { title: 'Strategy', description: 'A focused foundation for the work ahead. Clear goals, a shared direction, and room to explore.' },
      { title: 'Identity', description: 'A visual language with character. Built around who you are and where you want to go.' },
      { title: 'Digital', description: 'Useful, considered experiences that bring your story to the right people.' }
    ] } },
    { id: crypto.randomUUID(), type: 'Contact', props: { title: 'Tell us what you have in mind.', description: 'A new project, a question, or the start of something good.', button: 'Send message' } },
    { id: crypto.randomUUID(), type: 'Footer', props: { brand: portfolio ? 'Jordan Ellis' : 'Northline Studio', note: 'Made with care. Built to last.' } }
  ];
  return projectSchema.parse({ schemaVersion: 9, components: [], content: { services: [], portfolio: [], articles: [] }, id: crypto.randomUUID(), name: portfolio ? 'My portfolio' : 'My business website', updatedAt: new Date().toISOString(), theme: { accent: '#244c40', font: 'sans' },
    shared: { header: { id: nodes[0].id, props: nodes[0].props, enabled: true }, footer: { id: nodes[nodes.length - 1].id, props: nodes[nodes.length - 1].props, enabled: true } },
    pages: [{ id: 'home', name: 'Home', path: '/', inNavigation: true, title: portfolio ? 'Jordan Ellis · Portfolio' : 'Northline Studio', description: 'Considered design for ambitious people.', nodes: nodes.filter(n => n.type !== 'Header' && n.type !== 'Footer').map(node => portfolio && node.type === 'Services' ? { id: node.id, type: 'PortfolioCollection', props: { title: 'Selected work', description: 'Explore the websites and experiences I have helped create.', mobile: 1, tablet: 2, desktop: 2, gap: 32, design: 'gallery', motion: 'lift' } } : node) }] });
}
