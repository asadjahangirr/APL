import { useId } from 'react';
import type { ComponentProps } from '../project/schema';
import Footer from '../site/Footer';
import Services from '../site/Services';
import Text from '../site/Text';
import siteCss from '../site/site.css?inline';
import './composition-picker.css';

type FooterDesign = NonNullable<ComponentProps['Footer']['design']>;
type TextDesign = NonNullable<ComponentProps['Text']['design']>;
type ServicesDesign = NonNullable<ComponentProps['Services']['design']>;
type Selection =
  | { family: 'footer'; value: FooterDesign; onChange: (value: FooterDesign) => void }
  | { family: 'text'; value: TextDesign; onChange: (value: TextDesign) => void }
  | { family: 'services'; value: ServicesDesign; onChange: (value: ServicesDesign) => void };
const recipes = {
  footer: [
    { id: 'classic', label: 'Classic', description: 'A balanced line with brand, note and back-to-top.' },
    { id: 'columns', label: 'Columns', description: 'Generous two-column footer for a strong signature.' },
    { id: 'editorial', label: 'Editorial', description: 'Oversized brand with a fine dividing line.' },
    { id: 'framed', label: 'Framed', description: 'Contained footer with a clear border.' },
  ],
  text: [
    { id: 'classic', label: 'Classic', description: 'Simple heading and body copy.' },
    { id: 'editorial', label: 'Editorial', description: 'Headline beside a measured text column.' },
    { id: 'panel', label: 'Panel', description: 'Inset content on a contrasting surface.' },
  ],
  services: [
    { id: 'classic', label: 'Classic', description: 'Open numbered cards with fine rules.' },
    { id: 'bordered', label: 'Bordered', description: 'Contained panels for individual offerings.' },
    { id: 'numbered', label: 'Numbered rows', description: 'Large index numbers and horizontal divisions.' },
  ],
} as const;

export default function CommonDesignPicker(props: Selection) {
  const group = useId();
  return <fieldset className="composition-picker"><legend>{props.family === 'text' ? 'Text section' : props.family === 'services' ? 'Services section' : 'Footer'} design</legend><style>{siteCss}</style>
    <p>These are distinct layouts. Your content and theme colors stay the same.</p>
    <div className="composition-options">{recipes[props.family].map(recipe => <div className="composition-option" data-selected={props.value === recipe.id} key={recipe.id}>
      <input type="radio" name={group} checked={props.value === recipe.id} aria-label={`${recipe.label} ${props.family} design`} onChange={() => {
        if (props.family === 'footer') props.onChange(recipe.id as FooterDesign);
        else if (props.family === 'text') props.onChange(recipe.id as TextDesign);
        else props.onChange(recipe.id as ServicesDesign);
      }}/>
      <div className="composition-thumbnail thumbnail-common" inert aria-hidden="true"><div className="composition-canvas site">
        {props.family === 'footer' ? <Footer brand="Morgan Studio" note="Made with care, for people and place." design={recipe.id as FooterDesign}/> :
          props.family === 'text' ? <Text title="A considered way forward." body="Good work begins with a clear point of view. We give ideas room to grow." align="left" design={recipe.id as TextDesign}/> :
            <Services title="What we do" description="A few ways to make the work matter." items={[{title:'Strategy',description:'Find a direction.'},{title:'Design',description:'Make it tangible.'},{title:'Delivery',description:'Bring it to life.'}]} mobile={1} desktop={3} gap={24} design={recipe.id as ServicesDesign}/>}
      </div></div><strong>{recipe.label}</strong><small>{recipe.description}</small>
    </div>)}</div>
  </fieldset>;
}
