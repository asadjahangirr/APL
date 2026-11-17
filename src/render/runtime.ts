/**
 * The site's only script: "show / hide a layer" buttons. A click flips the
 * target's `data-apl-flip` attribute (the stylesheet shows a hidden layer or
 * hides a shown one, per screen size) and updates aria-expanded.
 *
 * Self-contained (no imports, no outside names) because exported sites embed
 * it as text: `(${installSite})(document)`.
 */
export function installSite(root: Document | HTMLElement): () => void {
  const onClick = (event: Event) => {
    const button = (event.target as Element | null)?.closest?.('[data-apl-toggle]');
    if (!button || !root.contains(button)) return;
    const id = button.getAttribute('data-apl-toggle') || '';
    const target = root.querySelector('#' + CSS.escape(id));
    if (!target) return;
    event.preventDefault();
    target.toggleAttribute('data-apl-flip');
    const shown = getComputedStyle(target).display !== 'none';
    root.querySelectorAll('[data-apl-toggle="' + id + '"]').forEach(other => other.setAttribute('aria-expanded', String(shown)));
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
