// Stable identities; visual recipes are shared by preview and export.
export const headerDesigns = [
 {value:'classic',label:'Classic',description:'Brand, navigation and a quiet text action.'},
 {value:'centered',label:'Centered',description:'A centered masthead with a separate navigation row.'},
 {value:'framed',label:'Framed',description:'An inset bar with a defined outline and filled action.'},
 {value:'editorial',label:'Editorial',description:'Oversized branding above a ruled navigation strip.'}
] as const;
export const heroDesigns = [
 {value:'split',label:'Split',description:'Balanced text and portrait, side by side.'},
 {value:'statement',label:'Statement',description:'A broad headline above a landscape image.'},
 {value:'centered',label:'Centered',description:'A centered introduction and panoramic image.'},
 {value:'editorial',label:'Editorial',description:'Large headline with a separate description column.'},
 {value:'portrait',label:'Portrait',description:'A portrait on the left, with an arched crop.'},
 {value:'inset',label:'Inset',description:'A solid text panel overlapping the image frame.'}
] as const;
