import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import { newProject } from '../src/project/templates';
import { addPage } from '../src/project/pages';
import { createStudioProject } from '../src/project/studio-document';
import { editorialStudy } from '../src/design/demo';
import { generateProject, type Sources } from '../src/export/generate';
const root = process.cwd();
const sources: Sources = {};
async function walk(dir: string) {
  for (const item of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (['node_modules','.next'].includes(item.name)) continue;
    const file = dir + '/' + item.name;
    if (item.isDirectory()) await walk(file);
    else sources[file] = await readFile(path.join(root,file), 'utf8');
  }
}
await walk('templates'); await walk('src/site');
sources['src/project/schema.ts'] = await readFile(path.join(root,'src/project/schema.ts'),'utf8');
sources['src/project/service-schema.ts'] = await readFile(path.join(root,'src/project/service-schema.ts'),'utf8');
sources['src/project/portfolio-schema.ts'] = await readFile(path.join(root,'src/project/portfolio-schema.ts'),'utf8');
sources['src/project/article-schema.ts'] = await readFile(path.join(root,'src/project/article-schema.ts'),'utf8');
sources['src/project/link-schema.ts'] = await readFile(path.join(root,'src/project/link-schema.ts'),'utf8');
sources['src/project/icon-schema.ts'] = await readFile(path.join(root,'src/project/icon-schema.ts'),'utf8');
sources['src/project/appearance-schema.ts'] = await readFile(path.join(root,'src/project/appearance-schema.ts'),'utf8');
sources['src/project/theme.ts'] = await readFile(path.join(root,'src/project/theme.ts'),'utf8');
const portfolio = process.argv.includes('--portfolio') || process.argv.includes('--portfolio-only');
const articles = process.argv.includes('--articles') || process.argv.includes('--articles-only');
const cms = process.argv.includes('--cms') || process.argv.includes('--portfolio');
const withoutContact = process.argv.includes('--static') || process.argv.includes('--cms-only') || process.argv.includes('--portfolio-only') || process.argv.includes('--articles-only');
let project = addPage(newProject(), 'About', '/about');
project.pages[1].title = 'About our independent studio';
project.pages[1].description = 'A second page with its own search description.';
project = addPage(project, 'Our approach', '/about/approach');
project.pages[2].inNavigation = false;
// Put the contact form on a non-home page to exercise global module resolution.
const inquiry = project.pages[0].nodes.find(node => node.type === 'Contact')!;
project.pages[0].nodes = project.pages[0].nodes.filter(node => node.type !== 'Contact');
if (withoutContact) project.shared.header.props.target = { pageId: 'home', anchor: '#services' };
else { project.pages[1].nodes.push(inquiry); project.shared.header.props.target = { pageId: project.pages[1].id, anchor: '#contact' }; }
project.pages[0].nodes.push({
  id: 'proof-layout', type: 'Section',
  props: { padding: { mobile: 24, tablet: 40, desktop: 64 }, width: 'wide', tone: 'soft' },
  children: [{
    id: 'proof-columns', type: 'Columns',
    props: { layout: { mobile: 'stack', tablet: 'halves', desktop: 'one-two' }, gap: { mobile: 12, tablet: 20, desktop: 32 }, align: 'center' },
    children: [
      { id: 'proof-left', type: 'Column', props: { gap: { mobile: 12, tablet: 20 }, align: 'start' }, children: [
        { id: 'proof-heading', type: 'Heading', props: { text: 'Built around your story', level: 'h2', size: 'large', align: 'left' } },
        { id: 'proof-paragraph', type: 'Paragraph', props: { text: 'A nested layout with real responsive controls, independent assets and a working page link.', align: 'left' } },
        { id: 'proof-button', type: 'Button', props: { label: 'Explore our approach', target: { pageId: project.pages[2].id, anchor: '#top' }, variant: 'outline', shape: 'pill', motion: 'lift' } }
      ] },
      { id: 'proof-right', type: 'Column', props: { gap: { mobile: 16 }, align: 'center' }, children: [
        { id: 'proof-image', type: 'Image', props: { image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', alt: 'A small local test image', ratio: 'landscape', radius: 'soft' } }
      ] }
    ]
  }]
});
if (cms || process.argv.includes('--cms-only')) {
  project.pages[0].nodes.push({ id: 'proof-service-collection', type: 'ServiceCollection', props: { title: 'Explore our services', description: 'Published services from an owner-controlled CMS.', mobile: 1, tablet: 2, desktop: 3, gap: 24, design: 'classic', motion: 'none' } });
  const published = { title: 'Brand strategy', slug: 'brand-strategy', summary: 'A published service for independent verification.', body: 'Research, positioning and a clear direction for your business.', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', imageAlt: 'A small owner supplied image' };
  project.content.services = [
    { id: '4bcae2e1-8860-4e43-aaf5-f93f754092d4', draft: { ...published, slug: '' }, published: { ...published }, revision: 2, publishedRevision: 1 },
    { id: 'e3b121e1-c9ee-468b-9716-cc1e7d55ff71', draft: { title: 'Private draft offering', slug: 'private-draft-offering', summary: 'This unpublished summary must never reach the public website.', body: 'Private draft body used to check content isolation.', image: published.image, imageAlt: 'Private draft image' }, published: null, revision: 1, publishedRevision: null }
  ];
}
if (articles) {
  project.pages[0].nodes.push({ id: 'proof-article-collection', type: 'ArticleCollection', props: { title: 'Field notes', description: 'Published articles from an owner-controlled CMS.', mobile: 1, tablet: 2, desktop: 3, gap: 24, design: 'tiles', motion: 'lift' } });
  const published = { title: 'A considered approach', slug: 'considered-approach', summary: 'An article published for independent verification.', body: 'Good work begins with a clear direction.\n\nThis article stays on the owner website.', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', imageAlt: 'A small owner supplied article cover' };
  project.content.articles = [
    { id: '4a444faa-3886-4dd9-b264-e2544d968a72', draft: { ...published, title: 'Private article revision', slug: '' }, published, revision: 2, publishedRevision: 1 },
    { id: 'e0ea5089-3baa-482d-b7cd-93e94f7d3b88', draft: { ...published, title: 'Unpublished story', slug: 'unpublished-story' }, published: null, revision: 1, publishedRevision: null },
  ];
}
if (portfolio) {
  // Exercise every structural design in the independent responsive proof.
  const designs = ['gallery', 'editorial', 'split', 'poster', 'index', 'framed'] as const;
  const motions = ['none', 'lift', 'zoom', 'reveal'] as const;
  for (const [index, design] of designs.entries()) {
    if (index > 0) project = addPage(project, 'Portfolio ' + design, '/work-' + design);
    const page = index === 0 ? project.pages[2] : project.pages[project.pages.length - 1];
    page.nodes.push({
      id: 'proof-portfolio-' + design, type: 'PortfolioCollection',
      props: { title: 'Selected work - ' + design, description: 'Owner-managed projects that open their own websites.', mobile: 1, tablet: 2, desktop: 3, gap: 24, design, motion: motions[index % motions.length] },
    });
  }
  const published = { title: 'Northline identity', summary: 'A public project connected to its own website.', category: 'Brand identity', externalUrl: 'https://portfolio-fixture.example/northline', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', imageAlt: 'An owner supplied portfolio cover' };
  project.content.portfolio = [
    { id: '63060fd5-4543-4fc4-87e8-fb6659b91a18', draft: { ...published, title: 'Private next Northline title', externalUrl: '' }, published: { ...published }, revision: 2, publishedRevision: 1 },
    ...[
      { id: '3116ff1e-072e-474f-83f2-7a41a4d46961', title: 'Fieldwork studio', category: 'Website design', externalUrl: 'https://portfolio-fixture.example/fieldwork' },
      { id: '89a22010-4e41-480a-bc5b-f18af05e27eb', title: 'Common ground', category: 'Editorial', externalUrl: 'https://portfolio-fixture.example/common-ground' },
    ].map(({ id, ...fields }) => ({ id, draft: { ...published, ...fields, image: '', imageAlt: '' }, published: { ...published, ...fields, image: '', imageAlt: '' }, revision: 1, publishedRevision: 1 })),
    { id: 'c6673e73-df3a-4ebc-9949-22a16c67bec9', draft: { ...published, title: 'Private portfolio draft', summary: 'This draft must stay out of public markup.', externalUrl: 'https://portfolio-fixture.example/private' }, published: null, revision: 1, publishedRevision: null },
  ];
}
const withDesign = process.argv.includes('--design');
const baseArtifact = articles ? (withoutContact ? 'articles-only-export' : 'articles-business-export') : portfolio ? (withoutContact ? 'portfolio-only-export' : 'portfolio-business-export') : cms || process.argv.includes('--cms-only') ? (withoutContact ? 'cms-only-export' : 'cms-business-export') : (withoutContact ? 'layout-static-export' : 'layout-business-export');
// Keep the prior accepted website fixtures intact while testing populated Design backups.
const artifact = withDesign ? 'phase-2-' + baseArtifact : baseArtifact;
const destination = path.join(root,'.artifacts', artifact);
const input = withDesign ? createStudioProject(project, editorialStudy()) : project;
const { files } = await generateProject(input,sources);
for (const [file,bytes] of Object.entries(files)) { const target = path.join(destination,file); await mkdir(path.dirname(target), { recursive:true }); await writeFile(target,bytes); }
console.log('Generated independent export: ' + destination);
await writeFile(destination + '.zip', zipSync(files));
