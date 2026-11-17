import { useEffect, useMemo, useRef, useState } from 'react';
import { filterCommands, formatCombo, type Command } from './commands';
import { MagnifyingGlass } from './icons';

/** Ctrl/⌘+K: search and run any editor command; doubles as the shortcut reference. */
export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active]);
  const run = (command: Command | undefined) => { if (!command) return; onClose(); requestAnimationFrame(() => command.run()); };
  return (
    <div className="ed-palette-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="ed-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="ed-palette-search">
          <MagnifyingGlass size={16} />
          <input
            autoFocus value={query} placeholder="Search commands and shortcuts…" aria-label="Search commands"
            role="combobox" aria-expanded="true" aria-controls="ed-palette-list" aria-activedescendant={results[active] ? 'cmd-' + results[active].id : undefined}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              event.stopPropagation();
              if (event.key === 'Escape') onClose();
              else if (event.key === 'ArrowDown') { event.preventDefault(); setActive(i => Math.min(results.length - 1, i + 1)); }
              else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => Math.max(0, i - 1)); }
              else if (event.key === 'Enter') { event.preventDefault(); run(results[active]); }
            }}
          />
        </div>
        <ul id="ed-palette-list" role="listbox" ref={list}>
          {results.map((command, index) => (
            <li key={command.id} id={'cmd-' + command.id} role="option" aria-selected={index === active}
              onPointerMove={() => setActive(index)} onClick={() => run(command)}>
              <span className="ed-palette-group">{command.group}</span>
              <span className="ed-palette-label">{command.label}</span>
              {command.keys?.[0] && <kbd>{formatCombo(command.keys[0])}</kbd>}
            </li>
          ))}
          {!results.length && <li className="ed-palette-empty">No matching commands</li>}
        </ul>
      </div>
    </div>
  );
}
