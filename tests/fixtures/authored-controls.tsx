import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Render } from '@puckeditor/core';
import AppearanceField, { ButtonDestinationField } from '../../src/editor/AppearanceField';
import PageManager from '../../src/editor/PageManager';
import { createConfig, toEditor } from '../../src/editor/config';
import { addPage } from '../../src/project/pages';
import { newProject } from '../../src/project/templates';
import { projectSchema, walkNodes, type BodyNode, type ComponentProps, type Project } from '../../src/project/schema';
import '../../src/studio.css';

/** Browser-only host for real editor controls and the real public rendering path. */
export function mountAuthoredControls(container: HTMLDivElement) {
  const initial = addPage(newProject(), 'About', '/about');
  initial.pages[0].showHeader = false; initial.pages[0].showFooter = false;
  initial.pages[0].nodes = [
    { id: 'authored-section', type: 'Section', props: {
      width: 'full', tone: 'plain', padding: { mobile: 24 }, anchor: '#c-introduction',
      appearance: { paddingX: { mobile: 20, tablet: 40, desktop: 80 }, paddingY: { mobile: 24 }, gap: { mobile: 18 }, background: { mobile: '#f7f4ee' } },
    }, children: [
      { id: 'authored-heading', type: 'Heading', props: {
        text: 'A real, editable heading.', level: 'h1', size: 'large', align: 'left',
        appearance: { fontFamily: { mobile: 'Georgia' }, fontSize: { mobile: 32.123456789, tablet: 44, desktop: 64 }, fontWeight: { mobile: 400 }, lineHeight: { mobile: 1.2 }, color: { mobile: '#123456' } },
      } },
      { id: 'authored-copy', type: 'Paragraph', props: { text: 'Readable content stays as real text.', align: 'left', appearance: { fontSize: { mobile: 16, desktop: 20 } } } },
      { id: 'authored-image', type: 'Image', props: { image: '', alt: '', ratio: 'portrait', radius: 'none', appearance: { aspectRatio: { mobile: 1.5, desktop: 2 }, radius: { mobile: 12 } } } },
      { id: 'authored-action', type: 'Button', props: { label: 'Get in touch', target: { pageId: initial.pages[1].id, anchor: '#top' }, variant: 'solid', shape: 'rounded', motion: 'none', appearance: { minHeight: { mobile: 48 } } } },
    ] },
    { id: 'authored-contact', type: 'Contact', props: { title: 'Let’s talk.', description: 'A working form keeps its real labels.', button: 'Send message',
      appearance: { fontFamily: { mobile: 'Arial' }, fontSize: { mobile: 20, desktop: 24 }, background: { mobile: '#e9efeb' }, paddingX: { mobile: 20 }, paddingY: { mobile: 28 }, gap: { mobile: 28 } },
      fieldAppearance: { radius: { mobile: 8 }, borderWidth: { mobile: 2 }, borderColor: { mobile: '#123456' } },
      buttonAppearance: { background: { mobile: '#264f40' }, minHeight: { mobile: 48 } },
    } },
  ];
  let present = projectSchema.parse(initial);
  const root = createRoot(container);
  function Fixture() {
    const [project, setProject] = useState(present), [pagesOpen, setPagesOpen] = useState(false);
    const nodes = walkNodes(project.pages[0].nodes);
    const heading = nodes.find(node => node.id === 'authored-heading')! as BodyNode & { props: ComponentProps['Heading'] };
    const button = nodes.find(node => node.id === 'authored-action')! as BodyNode & { props: ComponentProps['Button'] };
    present = project;
    function update(id: string, field: string, value: unknown) {
      setProject(previous => {
        const next = structuredClone(previous);
        const node = walkNodes(next.pages[0].nodes).find(node => node.id === id)!;
        if (value === undefined) delete (node.props as Record<string, unknown>)[field];
        else (node.props as Record<string, unknown>)[field] = value;
        return projectSchema.parse(next);
      });
    }
    return <>
      <style>{`
        body{margin:0;background:#fff}.authored-controls-host{display:grid;gap:24px;padding:16px;min-width:0}
        .authored-controls-panel{width:100%;max-width:360px;min-width:0;padding:12px;border:1px solid #ccd5ce;border-radius:12px}
        .authored-preview{min-width:0;width:100%}.authored-preview .site{width:100%}
        .authored-preview .apl-image-placeholder{height:auto;min-height:0}
      `}</style>
      <div className="authored-controls-host">
        <section className="authored-preview" aria-label="Rendered website"><Render config={createConfig(project, project.pages[0].id, true)} data={toEditor(project)}/></section>
        <section className="authored-controls-panel" aria-label="Appearance controls">
          <AppearanceField label="Heading appearance" value={heading.props.appearance} onChange={value => update(heading.id, 'appearance', value)}/>
          <ButtonDestinationField value={button.props.destination} onChange={value => update(button.id, 'destination', value)}/>
          <button type="button" onClick={() => setPagesOpen(true)}>Manage pages</button>
        </section>
      </div>
      {pagesOpen && <PageManager project={project} activeId={project.pages[0].id} select={() => {}} close={() => setPagesOpen(false)} change={next => setProject(next)}/>}
    </>;
  }
  flushSync(() => root.render(<Fixture/>));
  return { snapshot: () => structuredClone(present), unmount: () => { flushSync(() => root.unmount()); container.remove(); } };
}
