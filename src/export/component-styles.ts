/** A small structural CSS reader. Inputs are the checked-in production stylesheet. */
function split(value: string, delimiter: string): string[] {
  const parts: string[] = []; let start = 0, depth = 0, quote = '';
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (quote) { if (character === '\\') index++; else if (character === quote) quote = ''; continue; }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(' || character === '[') depth++;
    else if (character === ')' || character === ']') depth--;
    else if (character === delimiter && depth === 0) { parts.push(value.slice(start, index)); start = index + 1; }
  }
  parts.push(value.slice(start)); return parts;
}
type Rule = { head: string; body?: string };
function rules(input: string): Rule[] {
  const result: Rule[] = []; let start = 0, quote = '', parentheses = 0;
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (quote) { if (character === '\\') index++; else if (character === quote) quote = ''; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '(' || character === '[') parentheses++;
    if (character === ')' || character === ']') parentheses--;
    if (parentheses) continue;
    if (character === ';') { const head = input.slice(start, index + 1).trim(); if (head) result.push({ head }); start = index + 1; }
    if (character !== '{') continue;
    const head = input.slice(start, index).trim(), opening = index;
    let depth = 1, innerQuote = '';
    while (++index < input.length && depth) {
      const next = input[index];
      if (innerQuote) { if (next === '\\') index++; else if (next === innerQuote) innerQuote = ''; }
      else if (next === '"' || next === "'") innerQuote = next;
      else if (next === '{') depth++;
      else if (next === '}') depth--;
    }
    if (depth) throw new Error('The production stylesheet contains an unclosed rule.');
    result.push({ head, body: input.slice(opening + 1, index - 1) }); start = index;
    index--;
  }
  if (input.slice(start).trim()) throw new Error('The production stylesheet contains an incomplete rule.');
  return result;
}
export function selectedStyles(stylesheet: string, componentSources: string[]): string {
  const classes = new Set(['site', 'apl-authored']);
  for (const source of componentSources) for (const match of source.matchAll(/(?:className\s*=\s*(?:\{\s*)?|authoredClass\(\s*)['"]([^'"]+)['"]/g)) {
    for (const value of match[1].split(/\s+/)) if (/^[a-zA-Z_][\w-]*$/.test(value)) classes.add(value);
  }
  const keyframes: Rule[] = [];
  const filter = (input: string): string => rules(input.replace(/\/\*[\s\S]*?\*\//g, '')).flatMap(rule => {
    if (rule.body === undefined) return rule.head.startsWith('@import') ? [rule.head] : [];
    if (rule.head.startsWith('@keyframes')) { keyframes.push(rule); return []; }
    if (rule.head.startsWith('@')) { const body = filter(rule.body); return body ? [rule.head + '{' + body + '}'] : []; }
    const selectors = split(rule.head, ',').filter(selector => [...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].every(match => classes.has(match[1])));
    return selectors.length ? [selectors.join(',') + '{' + rule.body + '}'] : [];
  }).join('\n');
  const selected = filter(stylesheet);
  return selected + '\n' + keyframes.filter(rule => selected.includes(rule.head.replace(/^@keyframes\s+/, '').trim())).map(rule => rule.head + '{' + rule.body + '}').join('\n') + '\n';
}
