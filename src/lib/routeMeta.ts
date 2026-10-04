/**
 * Per-route <head> metadata. The single source for both the prerender, which bakes it into each
 * route's HTML (src/entry-server.tsx), and the client, which updates it on navigation (App), so
 * the two always agree.
 */
export const SITE = 'https://bottlenecker.arkynate.com';

export interface RouteMeta {
  title: string;
  description: string;
  /** og/twitter description when it differs from `description`. */
  socialDescription?: string;
}

export const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    title: 'Bottlenecker — Find Architecture Bottlenecks Before They Hit Production',
    description: 'Free visual tool for detecting system architecture bottlenecks. Model servers, databases, caches and queues, simulate load, and see exactly where performance bottlenecks occur — in your browser, no signup needed.',
    socialDescription: 'Free visual tool for detecting system architecture bottlenecks. Model your system, simulate load, spot performance bottlenecks instantly.',
  },
  '/components': {
    title: 'System Components — Bottlenecker Architecture Bottleneck Simulator',
    description: 'Reference for all system architecture components in Bottlenecker: servers, databases, caches, queues, load balancers, and edges. Understand how each node contributes to system bottlenecks.',
  },
  '/lessons': {
    title: 'Architecture Bottleneck Lessons — Learn to Avoid System Bottlenecks | Bottlenecker',
    description: 'Lessons on common system architecture bottlenecks: database overload, cache misses, queue saturation, and more. Learn how to identify and avoid bottlenecks with real diagrams.',
  },
  '/playground': {
    title: 'Playground — Simulate Architecture Bottlenecks | Bottlenecker',
    description: 'Interactive canvas to simulate system architecture bottlenecks. Add components, set capacities, run load simulations, and identify performance bottlenecks in real time.',
  },
  '/privacy': {
    title: 'Privacy — Bottlenecker',
    description: 'What Bottlenecker collects: anonymous usage counts and Google AdSense cookies. Your diagrams stay in your browser.',
  },
};

export const NOT_FOUND_META: RouteMeta = {
  title: 'Page not found | Bottlenecker',
  description: 'There is nothing at this address.',
};

/** `/lessons/` → `/lessons`; the root stays `/`. */
export function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

export function routeMeta(pathname: string): RouteMeta {
  return ROUTE_META[normalizePath(pathname)] ?? NOT_FOUND_META;
}

/** A head tag a route rewrites: `<tag key="name" attr="value">`. */
export interface HeadTag {
  tag: 'meta' | 'link';
  key: 'name' | 'property' | 'rel';
  name: string;
  attr: 'content' | 'href';
  value: string;
}

/** Every tag a route sets besides <title>. Unknown paths get their own URL: they render a noindex 404, not a duplicate of Home (#21). */
export function headTags(pathname: string): HeadTag[] {
  const meta = routeMeta(pathname);
  const url = SITE + normalizePath(pathname);
  const social = meta.socialDescription ?? meta.description;
  return [
    { tag: 'meta', key: 'name',     name: 'description',         attr: 'content', value: meta.description },
    { tag: 'link', key: 'rel',      name: 'canonical',           attr: 'href',    value: url },
    { tag: 'meta', key: 'property', name: 'og:url',              attr: 'content', value: url },
    { tag: 'meta', key: 'property', name: 'og:title',            attr: 'content', value: meta.title },
    { tag: 'meta', key: 'property', name: 'og:description',      attr: 'content', value: social },
    { tag: 'meta', key: 'name',     name: 'twitter:title',       attr: 'content', value: meta.title },
    { tag: 'meta', key: 'name',     name: 'twitter:description', attr: 'content', value: social },
  ];
}

/** Client only: points document.title and the head tags at the current route. */
export function applyRouteHead(pathname: string): void {
  document.title = routeMeta(pathname).title;
  for (const t of headTags(pathname)) {
    document.querySelector(`${t.tag}[${t.key}="${t.name}"]`)?.setAttribute(t.attr, t.value);
  }
}
