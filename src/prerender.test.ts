import { describe, expect, it } from 'vitest';
import template from '../index.html?raw';
import { PRERENDER_ROUTES, renderPage } from './entry-server';
import { injectRoute } from './lib/prerenderHtml';
import { ROUTE_META, SITE } from './lib/routeMeta';

/** What a crawler must find in each prerendered file without running JavaScript (B1). */
const H1: Record<string, string | null> = {
  '/':           'Find Your Architecture Bottleneck Before Your Users Do',
  '/components': 'Component Reference',
  '/lessons':    'Architecture Bottleneck Lessons',
  '/privacy':    'Privacy',
  '/playground': null, // a shell: navbar + loading fallback, React Flow never runs on the server
};

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('prerendered routes', () => {
  it('covers every route with head metadata', () => {
    expect([...PRERENDER_ROUTES].sort()).toEqual(Object.keys(ROUTE_META).sort());
  });

  for (const route of PRERENDER_ROUTES) {
    it(`${route} carries its content and head`, async () => {
      const html = await renderPage(route, template);
      const meta = ROUTE_META[route];
      const url = SITE + route;

      expect(html).toContain(`<title>${meta.title}</title>`);
      expect(html).toContain(`<meta name="description" content="${meta.description}"`);
      expect(html).toContain(`<link rel="canonical" href="${url}"`);
      expect(html).toMatch(new RegExp(`<meta property="og:url"\\s+content="${url}"`));
      expect(html).toMatch(new RegExp(`<meta property="og:title"\\s+content="${meta.title}"`));
      expect(html).toContain(`<body data-prerendered="${route}">`);
      // The rest of the template survives: JSON-LD and the AdSense tags.
      expect(html.match(/application\/ld\+json/g)).toHaveLength(3);
      expect(html).toContain('<meta name="google-adsense-account"');
      expect(html).toContain('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');

      const h1 = html.match(/<h1[\s>][\s\S]*?<\/h1>/)?.[0];
      if (H1[route]) expect(text(h1 ?? '')).toBe(H1[route]);
      else expect(h1).toBeUndefined();
    });
  }

  it('keeps Home’s shorter social description', async () => {
    const html = await renderPage('/', template);
    expect(html).toMatch(new RegExp(`<meta property="og:description"\\s+content="${ROUTE_META['/'].socialDescription}"`));
  });

  it('refuses a template that lost a tag it rewrites', () => {
    expect(() => injectRoute(template.replace(/<link rel="canonical"[^>]*>/, ''), '/lessons', '<main></main>'))
      .toThrow(/canonical/);
  });
});
