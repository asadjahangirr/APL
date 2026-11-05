import { useState } from 'react';
import Dialog from './Dialog';
import { projectSchema, type Project } from '../project/schema';
import { themePresets, themeStyle, contrastRatio, type SiteTheme } from '../project/theme';
import './ThemeManager.css';
const colors = [
  ['accent', 'Accent'], ['background', 'Background'], ['surface', 'Surface'],
  ['ink', 'Text'], ['muted', 'Secondary text'], ['line', 'Borders'],
] as const;
export default function ThemeManager({ project, save, close }: { project: Project; save: (value: Project) => void; close: () => void }) {
  const [theme, setTheme] = useState<SiteTheme>(project.theme);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(theme) !== JSON.stringify(project.theme);
  function leave() { if (!dirty || window.confirm('Discard unsaved theme changes?')) close(); }
  const bodyContrast = contrastRatio(theme.ink, theme.background);
  const secondaryContrast = contrastRatio(theme.muted, theme.background);
  return <Dialog title="Site theme" wide close={leave}>
    <p>Start with a palette, then make it yours. These colors and typography apply across every page and are included in your export.</p>
    <div className="theme-workspace">
      <div>
        <fieldset className="theme-presets"><legend>Palette presets · 6</legend>
          {themePresets.map(preset => <label key={preset.id} className="theme-preset">
            <input type="radio" name="theme-preset" aria-label={preset.name} checked={JSON.stringify(theme) === JSON.stringify(preset.theme)} onChange={() => setTheme({ ...preset.theme })}/>
            <span className="theme-swatches" aria-hidden="true">{[preset.theme.background, preset.theme.surface, preset.theme.ink, preset.theme.accent].map((color, index) => <i key={index} style={{ background: color }}/>)}</span>
            <strong>{preset.name}</strong><small>{preset.description}</small>
          </label>)}
        </fieldset>
        <fieldset className="theme-colors"><legend>Custom colors</legend>{colors.map(([key, label]) => <label key={key}>
          <span>{label}</span><input type="color" aria-label={label + ' color'} value={theme[key]} onChange={event => setTheme({ ...theme, [key]: event.target.value })}/><code>{theme[key]}</code>
        </label>)}</fieldset>
        <fieldset className="theme-fonts"><legend>Typography</legend>
          {([['sans','Modern sans'],['humanist','Humanist'],['serif','Classic serif']] as const).map(([value,label]) => <label key={value} data-font={value}>
            <input type="radio" name="theme-font" aria-label={label} checked={theme.font === value} onChange={() => setTheme({ ...theme, font: value })}/><span>{label}</span>
          </label>)}
        </fieldset>
        <small>Three system-font families; appearance follows the fonts available on the visitor's device.</small>
      </div>
      <div className="theme-sample" style={themeStyle(theme)} data-font={theme.font}>
        <p className="theme-sample-kicker">YOUR PALETTE</p><h3>Make room<br/>for your best work.</h3>
        <p>A clear hierarchy, a considered color palette, and a little space to let your work speak.</p>
        <div className="theme-sample-surface"><strong>A different perspective.</strong><p>Your secondary surface and text colors, together.</p></div>
        <span className="theme-sample-action">Explore the work <span aria-hidden="true">↗</span></span>
        <p className="theme-contrast" role="status">Body text: {bodyContrast.toFixed(1)}:1. Secondary text: {secondaryContrast.toFixed(1)}:1.
          {(bodyContrast < 4.5 || secondaryContrast < 4.5) && ' Increase contrast for easier reading.'}</p>
      </div>
    </div>
    {error && <p role="alert">{error}</p>}
    <footer><button onClick={leave}>Cancel</button><button className="primary" onClick={() => {
      try { save(projectSchema.parse({ ...project, theme, updatedAt: new Date().toISOString() })); close(); }
      catch { setError('Use complete six-digit hex colors before applying the theme.'); }
    }}>Apply theme</button></footer>
  </Dialog>;
}
