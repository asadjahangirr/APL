/** Stable recipe IDs. Layout recipes are counted separately from theme and motion settings. */
export type CollectionMotion = 'none' | 'lift' | 'zoom' | 'reveal';
export type PortfolioDesign = 'gallery' | 'editorial' | 'split' | 'poster' | 'index' | 'framed';
export type ServiceDesign = 'classic' | 'tiles' | 'bands' | 'spotlight';
export type ArticleDesign = 'classic' | 'tiles' | 'bands' | 'spotlight';
export type CollectionDesign<Id extends string = string> = {
  id: Id;
  family: 'portfolio' | 'services' | 'articles';
  label: string;
  description: string;
  layout: 'grid' | 'list';
  columns: 'configurable' | 'single';
  layoutNotice?: string;
};
export const portfolioCollectionDesigns: readonly CollectionDesign<PortfolioDesign>[] = [
  { id: 'gallery', family: 'portfolio', label: 'Gallery', description: 'Wide images with a quiet caption beneath.', layout: 'grid', columns: 'configurable' },
  { id: 'editorial', family: 'portfolio', label: 'Editorial', description: 'Numbered stories, bold titles, and portrait images.', layout: 'grid', columns: 'configurable' },
  { id: 'split', family: 'portfolio', label: 'Split', description: 'Image and project notes sit side by side.', layout: 'grid', columns: 'configurable' },
  { id: 'poster', family: 'portfolio', label: 'Poster', description: 'Full-height imagery with a solid inset caption.', layout: 'grid', columns: 'configurable' },
  { id: 'index', family: 'portfolio', label: 'Index', description: 'A numbered directory with a compact image and link.', layout: 'list', columns: 'single', layoutNotice: 'Index uses one project per row on every screen. Your column values are preserved for grid designs.' },
  { id: 'framed', family: 'portfolio', label: 'Framed', description: 'Inset imagery with a border and divided information panel.', layout: 'grid', columns: 'configurable' },
];
export const serviceCollectionDesigns: readonly CollectionDesign<ServiceDesign>[] = [
  { id: 'classic', family: 'services', label: 'Classic', description: 'Open cards with a fine accent rule and numbered headings.', layout: 'grid', columns: 'configurable' },
  { id: 'tiles', family: 'services', label: 'Tiles', description: 'Contained panels with an image and compact information.', layout: 'grid', columns: 'configurable' },
  { id: 'bands', family: 'services', label: 'Bands', description: 'Horizontal rows with service notes beside an image.', layout: 'list', columns: 'single', layoutNotice: 'Bands uses one service per row on every screen. Your column values are preserved for grid designs.' },
  { id: 'spotlight', family: 'services', label: 'Spotlight', description: 'Large headings above a framed image and description.', layout: 'grid', columns: 'configurable' },
];
export const articleCollectionDesigns: readonly CollectionDesign<ArticleDesign>[] = [
  { id: 'classic', family: 'articles', label: 'Journal', description: 'Open editorial cards with clear reading links.', layout: 'grid', columns: 'configurable' },
  { id: 'tiles', family: 'articles', label: 'Covers', description: 'Image-led stories in contained panels.', layout: 'grid', columns: 'configurable' },
  { id: 'bands', family: 'articles', label: 'Reading list', description: 'Horizontal rows pairing each title with its cover.', layout: 'list', columns: 'single', layoutNotice: 'Reading list uses one article per row. Grid column values remain available for other designs.' },
  { id: 'spotlight', family: 'articles', label: 'Spotlight', description: 'Large titles and framed imagery for feature stories.', layout: 'grid', columns: 'configurable' },
];
