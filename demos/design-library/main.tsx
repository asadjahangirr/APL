import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Header from '../../src/site/Header';
import Hero from '../../src/site/Hero';
import Button from '../../src/site/Button';
import {themePresets,themeStyle} from '../../src/project/theme';
import {headerDesigns,heroDesigns} from '../../src/editor/composition-designs';
import {buttonDesigns} from '../../src/site/layout-utils';
import type {ComponentProps} from '../../src/project/schema';
import css from '../../src/site/site.css?inline';
import data from '../alex-morgan/alex-morgan.apl.json';
function Library(){
 const [header,setHeader]=useState<NonNullable<ComponentProps['Header']['design']>>('editorial');
 const [hero,setHero]=useState<ComponentProps['Hero']['layout']>('editorial');
 const [theme,setTheme]=useState('editorial');
 const [motion,setMotion]=useState<ComponentProps['Button']['motion']>('arrow');
 const chosen=themePresets.find(t=>t.id===theme)!.theme;
 const original=data.pages[0].nodes.find(n=>n.type==='Hero')!;
 return <><style>{css}</style><div style={{padding:16,display:'flex',gap:16,flexWrap:'wrap',font:'14px Arial',background:'#fff',color:'#202824',borderBottom:'1px solid #ddd'}}>
 <label>Header <select aria-label="Header design" value={header} onChange={e=>setHeader(e.target.value as typeof header)}>{headerDesigns.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
 <label>Hero <select aria-label="Hero design" value={hero} onChange={e=>setHero(e.target.value as typeof hero)}>{heroDesigns.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
 <label>Theme <select aria-label="Theme" value={theme} onChange={e=>setTheme(e.target.value)}>{themePresets.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
 <label>Button motion <select aria-label="Button motion" value={motion} onChange={e=>setMotion(e.target.value as typeof motion)}>{['none','lift','arrow','press','sweep'].map(d=><option key={d}>{d}</option>)}</select></label>
 <a href="../alex-morgan-multipage/full.html">Open four-page portfolio</a>
 </div><main className="site" id="top" data-font={chosen.font} style={themeStyle(chosen)}>
 <Header brand="Alex Morgan" linkLabel="Get in touch" target={{pageId:'home',anchor:'#top'}} href="#buttons" design={header} links={[{id:'home',label:'Home',href:'#top'},{id:'work',label:'Work',href:'#buttons'},{id:'about',label:'About',href:'#buttons'},{id:'contact',label:'Contact',href:'#buttons'}]} activePageId="home"/>
 <Hero key={hero} eyebrow="INDEPENDENT DESIGNER / SELECTED WORK" title={"A different\npoint of view."} description="Identity, digital experiences and thoughtful details. Made for people with something to say." image={(original.props as {image:string}).image} imageAlt="Original typographic artwork" layout={hero} motion="reveal"/>
 <section className="site-section site-container" id="buttons"><h2>Eight ways to make a move.</h2><p>Real components, shared colors and five motion settings. Hover or use the keyboard.</p><div style={{display:'flex',flexWrap:'wrap',gap:32,marginTop:32}}>{buttonDesigns.map(d=><Button key={d.value} id={d.value} label={d.label} href="#top" target={{pageId:'home',anchor:'#top'}} variant={d.value} shape="rounded" motion={motion}/>)}</div></section>
 </main></>;
}
createRoot(document.getElementById('root')!).render(<Library/>);
