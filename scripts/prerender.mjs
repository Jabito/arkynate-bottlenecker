#!/usr/bin/env node
// Build-time prerender (B1, 2026-10-05 AdSense audit). Imports the SSR build of
// src/entry-server.tsx, renders each route with react-dom/server and writes it into
// dist/ (dist/index.html, dist/<route>/index.html), so crawlers get the page content
// and the route's own head without running JavaScript. No Puppeteer, no extra deps.
// deploy.sh also uploads each dist/<route>/index.html to the extension-less key
// (`lessons`), because the S3 REST origin looks up `/lessons` as key `lessons`.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const ssrDist = path.join(root, 'dist-server')
const SITE = 'https://bottlenecker.arkynate.com'

/** Visible words: scripts, styles and tags stripped. */
function wordCount(html) {
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
  return text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length
}

/** Fails the build when a written file lacks what crawlers need. */
function check(route, html) {
  const problems = []
  const canonical = `<link rel="canonical" href="${SITE}${route}"`
  if (!html.includes(canonical)) problems.push(`missing ${canonical}>`)
  if (!new RegExp(`<meta property="og:url"\\s+content="${SITE}${route}"`).test(html)) problems.push('og:url not set to the route')
  if (!html.includes(`<body data-prerendered="${route}">`)) problems.push('missing data-prerendered')
  if (!html.includes('application/ld+json')) problems.push('JSON-LD lost')
  if (!html.includes('google-adsense-account')) problems.push('AdSense meta lost')
  if (route !== '/playground' && !/<h1[\s>]/.test(html)) problems.push('no <h1>: page content did not render')
  if (problems.length) throw new Error(`prerender ${route}: ${problems.join('; ')}`)
}

async function main() {
  const entry = path.join(ssrDist, 'entry-server.js')
  await fs.access(entry).catch(() => {
    throw new Error(`SSR bundle missing at ${entry} (run vite build --ssr first)`)
  })
  const { PRERENDER_ROUTES, renderPage } = await import(pathToFileURL(entry).href)
  const template = await fs.readFile(path.join(dist, 'index.html'), 'utf-8')

  for (const route of PRERENDER_ROUTES) {
    const html = await renderPage(route, template)
    check(route, html)
    const out = route === '/' ? path.join(dist, 'index.html') : path.join(dist, route.slice(1), 'index.html')
    await fs.mkdir(path.dirname(out), { recursive: true })
    await fs.writeFile(out, html, 'utf-8')
    console.log(`  prerendered  ${route.padEnd(12)} → ${path.relative(root, out).padEnd(28)} ${wordCount(html)} words`)
  }

  // Only dist/ ships.
  await fs.rm(ssrDist, { recursive: true, force: true })
}

main().catch(err => {
  console.error('prerender failed:', err)
  process.exit(1)
})
