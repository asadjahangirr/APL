import siteCss from '../site/site.css?inline';
import { useId } from 'react';
import Header from '../site/Header';
import Hero from '../site/Hero';
import Button from '../site/Button';
import { headerDesigns, heroDesigns } from './composition-designs';
import { buttonDesigns } from '../site/layout-utils';
import type { ComponentProps } from '../project/schema';
import './composition-picker.css';

type Selection = {family:'header';value:NonNullable<ComponentProps['Header']['design']>;onChange:(v:NonNullable<ComponentProps['Header']['design']>)=>void}
 | {family:'hero';value:ComponentProps['Hero']['layout'];onChange:(v:ComponentProps['Hero']['layout'])=>void}
 | {family:'button';value:ComponentProps['Button']['variant'];onChange:(v:ComponentProps['Button']['variant'])=>void};
const sampleHero = {eyebrow:'INDEPENDENT DESIGN',title:'A different\npoint of view.',description:'Thoughtful identities and digital experiences for people with something to say.',image:'',imageAlt:''};
export default function CompositionPicker(props: Selection) {
 const group=useId();
 const designs=props.family==='header'?headerDesigns:props.family==='hero'?heroDesigns:buttonDesigns;
 return <fieldset className="composition-picker"><legend>{props.family === 'header'?'Header':props.family === 'hero'?'Hero':'Button'} design</legend><style>{siteCss}</style>
 <p>Choose a layout. Your text, colors and destinations stay unchanged.</p>
 <div className="composition-options">{designs.map(design=><div className="composition-option" data-selected={props.value===design.value} key={design.value}>
 <input type="radio" name={group} aria-label={design.label+' '+props.family+' design'} checked={props.value===design.value} onChange={()=>{
  if(props.family==='header')props.onChange(design.value as NonNullable<ComponentProps['Header']['design']>);
  else if(props.family==='hero')props.onChange(design.value as ComponentProps['Hero']['layout']);
  else props.onChange(design.value as ComponentProps['Button']['variant']);
 }}/>
 <div className={'composition-thumbnail thumbnail-'+props.family} inert aria-hidden="true"><div className="composition-canvas site">
 {props.family==='header'?<Header brand="Morgan Studio" linkLabel="Let's talk" target={{pageId:'home',anchor:'#top'}} href="#" links={[{id:'home',label:'Home',href:'#'},{id:'work',label:'Work',href:'#'},{id:'about',label:'About',href:'#'}]} activePageId="home" design={design.value as ComponentProps['Header']['design']}/>:
 props.family==='hero'?<Hero {...sampleHero} layout={design.value as ComponentProps['Hero']['layout']} preview/>:
 <Button id={'sample-'+design.value} label="Explore work" target={{pageId:'home',anchor:'#top'}} href="#" variant={design.value as ComponentProps['Button']['variant']} shape="rounded" motion="none"/>}
 </div></div><strong>{design.label}</strong><small>{design.description}</small>
 </div>)}</div></fieldset>;
}
