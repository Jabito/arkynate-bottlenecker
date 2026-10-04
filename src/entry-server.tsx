import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { injectRoute } from './lib/prerenderHtml';
import { preloadRoute } from './routes';

/**
 * Build-time prerender (scripts/prerender.mjs imports the SSR build of this file). Each route's
 * HTML carries its content and head, so crawlers see the page without running JavaScript.
 * /playground is a shell (navbar, route head, loading fallback): React Flow never runs here.
 */
export const PRERENDER_ROUTES = ['/', '/components', '/lessons', '/privacy', '/playground'];

/** The app's markup for `url`, as main.tsx's first client render will produce it (desktop layout). */
export async function renderApp(url: string): Promise<string> {
  // renderToString can't wait for a lazy page, so load it first (src/routes.ts).
  if (url !== '/playground') await preloadRoute(url);
  return renderToString(
    <StrictMode>
      <ErrorBoundary>
        <StaticRouter location={url}>
          <App playgroundShell />
        </StaticRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
}

/** The complete HTML document for `url`, built from dist/index.html. */
export async function renderPage(url: string, template: string): Promise<string> {
  return injectRoute(template, url, await renderApp(url));
}
