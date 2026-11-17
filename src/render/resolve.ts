import type { SiteNode } from '../doc/schema';
import type { Breakpoint } from '../doc/breakpoints';

const NESTED = new Set(['layout', 'textStyle', 'sizing', 'constraints']);

/**
 * Apply breakpoint overrides desktop → tablet → mobile (each smaller breakpoint
 * inherits the larger one's overrides). Nested objects merge shallowly.
 */
export function resolveNode<T extends SiteNode>(node: T, breakpoint: Breakpoint): T {
  if (breakpoint === 'desktop') return node;
  const layers = breakpoint === 'tablet' ? [node.overrides.tablet] : [node.overrides.tablet, node.overrides.mobile];
  let out = node as Record<string, unknown>;
  for (const override of layers) {
    if (!override) continue;
    out = { ...out };
    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) continue;
      if (NESTED.has(key)) { if (out[key]) out[key] = { ...(out[key] as object), ...(value as object) }; }
      else out[key] = value;
    }
  }
  return out as T;
}
