import { headTags, routeMeta } from './routeMeta';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceOnce(html: string, pattern: RegExp, replace: (match: string) => string, what: string): string {
  if (!pattern.test(html)) throw new Error(`prerender: index.html has no ${what}`);
  return html.replace(pattern, replace);
}

/**
 * Fills the built index.html with one route's server-rendered markup and that route's <head>
 * (title, description, canonical, og and twitter tags from routeMeta). Everything else in the
 * template (JSON-LD, AdSense, bundles) is kept as is. Throws when the template lost a tag it
 * rewrites, so a template change can't silently ship Home's head on every route.
 */
export function injectRoute(template: string, route: string, appHtml: string): string {
  let html = replaceOnce(template, /<title>[^<]*<\/title>/, () => `<title>${escapeHtml(routeMeta(route).title)}</title>`, '<title>');

  for (const t of headTags(route)) {
    const tag = new RegExp(`<${t.tag}\\b[^>]*\\b${t.key}="${escapeRegExp(t.name)}"[^>]*>`);
    html = replaceOnce(html, tag, match => {
      const attr = new RegExp(`\\b${t.attr}="[^"]*"`);
      if (!attr.test(match)) throw new Error(`prerender: ${t.tag}[${t.key}="${t.name}"] has no ${t.attr}`);
      return match.replace(attr, () => `${t.attr}="${escapeHtml(t.value)}"`);
    }, `${t.tag}[${t.key}="${t.name}"]`);
  }

  html = replaceOnce(html, /<div id="root"><\/div>/, () => `<div id="root">${appHtml}</div>`, '<div id="root"></div>');
  // main.tsx hydrates only when this matches the address it was served for.
  return replaceOnce(html, /<body>/, () => `<body data-prerendered="${escapeHtml(route)}">`, '<body>');
}
