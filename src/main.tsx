import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { normalizePath } from './lib/routeMeta'
import { preloadRoute } from './routes'

const root = document.getElementById('root')!
const path = normalizePath(window.location.pathname)
// Set by scripts/prerender.mjs on each route's HTML.
const prerendered = document.body.dataset.prerendered

// CloudFront answers unknown paths with the prerendered Home. Another route's markup is dropped
// before first paint by the inline script in index.html; this repeats it in case that didn't run.
if (prerendered !== path) root.replaceChildren()

const tree = (
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)

// Load this route's page chunk before the first render, so the first render is the real page and
// never the Suspense fallback. Content routes hydrate their prerendered markup. The playground
// file is only a shell (React Flow doesn't run on the server): it stays on screen until the
// client render replaces it.
preloadRoute(path).then(() => {
  if (prerendered === path && path !== '/playground' && root.hasChildNodes()) {
    hydrateRoot(root, tree)
  } else {
    createRoot(root).render(tree)
  }
})
