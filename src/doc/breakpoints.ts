/** Dependency-free breakpoint constants shared by the editor, renderer and exported sites. */
export const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const;
export type Breakpoint = typeof BREAKPOINTS[number];
/** Canvas width used when designing each breakpoint. */
export const BREAKPOINT_WIDTH: Record<Breakpoint, number> = { desktop: 1440, tablet: 768, mobile: 390 };
/** Desktop-first: tablet styles apply below 1024px, mobile styles below 768px. */
export const BREAKPOINT_MAX: Record<Exclude<Breakpoint, 'desktop'>, number> = { tablet: 1023.98, mobile: 767.98 };
