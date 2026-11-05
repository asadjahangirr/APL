import { describe, expect, it } from 'vitest';
import { generateHTML, generateJSON } from '@tiptap/html/server';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';

describe('patched server HTML tooling compatibility', () => {
  it('round-trips schema-controlled text with the pinned DOM security override', () => {
    const text = 'A readable project <with literal markup> & plain text.';
    const extensions = [Document, Paragraph, Text];
    const document = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
    const html = generateHTML(document, extensions);
    expect(html).toBe('<p>A readable project &lt;with literal markup&gt; &amp; plain text.</p>');
    expect(generateJSON(html, extensions)).toEqual(document);
  });
});
