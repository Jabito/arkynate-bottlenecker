import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

const SITE = 'https://bottlenecker.arkynate.com'
const DEFAULT_ADSENSE_PUB_ID = 'ca-pub-4792941984956312'

const SITEMAP_ROUTES: { path: string; priority: string }[] = [
  { path: '/',           priority: '1.0' },
  { path: '/playground', priority: '0.9' },
  { path: '/components', priority: '0.8' },
  { path: '/lessons',    priority: '0.8' },
  { path: '/privacy',    priority: '0.3' },
]

/** Build date in PHT (UTC+8), YYYY-MM-DD. */
function buildDate(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
}

/**
 * Stamps index.html with the package version, build date and AdSense id, and
 * emits sitemap.xml with the same date, so the SEO metadata can't drift from
 * the release (#41, #84).
 */
function seoStamp(adsensePubId: string): Plugin {
  const date = buildDate()
  return {
    name: 'bottlenecker-seo-stamp',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html
        .replaceAll('__APP_VERSION__', version)
        .replaceAll('__BUILD_DATE__', date)
        .replaceAll('__ADSENSE_PUB_ID__', adsensePubId),
    },
    generateBundle() {
      const urls = SITEMAP_ROUTES.map(r => [
        '  <url>',
        `    <loc>${SITE}${r.path}</loc>`,
        `    <lastmod>${date}</lastmod>`,
        '    <changefreq>monthly</changefreq>',
        `    <priority>${r.priority}</priority>`,
        '  </url>',
      ].join('\n')).join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), tailwindcss(), seoStamp(env.VITE_ADSENSE_PUB_ID || DEFAULT_ADSENSE_PUB_ID)],
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
  }
})
