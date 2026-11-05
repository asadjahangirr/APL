import siteCss from '../site/site.css?inline';
import { useId } from 'react';
import PortfolioCollection from '../site/PortfolioCollection';
import ServiceCollection from '../site/ServiceCollection';
import ArticleCollection from '../site/ArticleCollection';
import type { CollectionDesign, PortfolioDesign, ServiceDesign, ArticleDesign } from '../site/collection-designs';
import './design-picker.css';

const portfolioSamples = [
  { id: 'preview-1', title: 'Form & field', category: 'Architecture', summary: 'A thoughtful digital home for a studio shaping everyday spaces.', externalUrl: 'https://example.com', image: '', imageAlt: '' },
  { id: 'preview-2', title: 'Northline', category: 'Brand & web', summary: 'An independent publication for people who keep exploring.', externalUrl: 'https://example.com', image: '', imageAlt: '' },
];
const serviceSamples = [
  { id: 'preview-1', title: 'Brand strategy', slug: 'strategy', summary: 'Find your point of view. Turn it into a clear direction.', body: '', image: '', imageAlt: '' },
  { id: 'preview-2', title: 'Digital design', slug: 'design', summary: 'Build considered experiences around your audience.', body: '', image: '', imageAlt: '' },
];
const articleSamples = [
  { id: 'preview-1', title: 'The shape of a good idea', slug: 'good-idea', summary: 'Notes on making useful work with a distinct point of view.', body: '', image: '', imageAlt: '' },
  { id: 'preview-2', title: 'A more considered process', slug: 'process', summary: 'What we learned by slowing down and asking better questions.', body: '', image: '', imageAlt: '' },
];

/** The thumbnail uses the real renderer. Inert content cannot navigate or gain focus. */
export default function DesignPicker<Id extends string>({ value, onChange, designs, label = 'Collection design' }: {
  value: Id;
  onChange: (value: Id) => void;
  designs: readonly CollectionDesign<Id>[];
  label?: string;
}) {
  const group = useId();
  const selected = designs.find(design => design.id === value);
  return <fieldset className="collection-design-picker">
    <legend>{label}</legend><style>{siteCss}</style>
    <p className="collection-design-intro">Choose a composition. Colors and motion are separate settings.</p>
    <div className="collection-design-options">{designs.map(design => {
      const inputId = group + '-' + design.id;
      return <div className="collection-design-option" data-selected={value === design.id} key={design.id}>
        <input className="collection-design-radio" id={inputId} type="radio" name={group} value={design.id} checked={value === design.id} aria-label={`${design.label} ${design.family} design`} onChange={() => onChange(design.id)} />
        <div className="collection-design-thumbnail" aria-hidden="true" inert>
          <div className="collection-design-canvas site">
            {design.family === 'portfolio' ? <PortfolioCollection title="Selected work" description="A collection of recent projects." items={portfolioSamples} mobile={design.id === 'split' ? 1 : 2} tablet={design.id === 'split' ? 1 : 2} desktop={design.id === 'split' ? 1 : 2} gap={28} design={design.id as PortfolioDesign} motion="none" sectionId={null} /> : design.family === 'articles' ? <ArticleCollection title="Field notes" description="Ideas worth sharing." items={articleSamples} mobile={2} tablet={2} desktop={2} gap={28} design={design.id as ArticleDesign} motion="none" sectionId={null} /> : <ServiceCollection title="Our expertise" description="Thoughtful work. Lasting results." items={serviceSamples} mobile={2} tablet={2} desktop={2} gap={28} design={design.id as ServiceDesign} motion="none" sectionId={null} />}
          </div>
        </div>
        <label className="collection-design-label" htmlFor={inputId}><span className="collection-design-name">{design.label}<span className="collection-design-check" aria-hidden="true">{value === design.id ? '\u2713' : ''}</span></span><span className="collection-design-description">{design.description}</span><span className="collection-design-layout">{design.columns === 'single' ? 'Single-column list' : 'Responsive grid'}</span></label>
      </div>;
    })}</div>
    {selected?.layoutNotice && <p className="collection-design-notice" role="note">{selected.layoutNotice}</p>}
  </fieldset>;
}
