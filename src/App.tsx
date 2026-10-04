import { Suspense, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { trackEvent } from './lib/analytics';
import { applyRouteHead } from './lib/routeMeta';
import { Pages } from './routes';

function RouteFallback() {
  return <div aria-busy="true" style={{ height: '100%', minHeight: 'calc(100vh - 50px)', background: 'var(--bg-base)' }} />;
}

/** Real "not found" page instead of a silent redirect home (soft 404s). React 19 hoists the meta to <head>. */
function NotFound() {
  return (
    <div style={{
      height: '100%', minHeight: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: 24, textAlign: 'center', background: 'var(--bg-base)',
    }}>
      <meta name="robots" content="noindex" />
      <h1 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, color: 'var(--text-strong)' }}>
        Page not found
      </h1>
      <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)' }}>There is nothing at this address.</p>
      <p style={{ margin: 0, fontSize: 15, display: 'flex', gap: 16 }}>
        <Link to="/" style={{ color: 'var(--accent)' }}>Home</Link>
        <Link to="/lessons" style={{ color: 'var(--accent)' }}>Lessons</Link>
        <Link to="/playground" style={{ color: 'var(--accent)' }}>Playground</Link>
      </p>
    </div>
  );
}

interface AppProps {
  /** Prerender only: render /playground as its loading fallback, so React Flow never runs on the server. */
  playgroundShell?: boolean;
}

export default function App({ playgroundShell = false }: AppProps) {
  const location = useLocation();

  useEffect(() => {
    trackEvent('page_view');
  }, [location.pathname]);

  // Title, description, canonical, og and twitter tags (#21). The prerender bakes in the same values.
  useEffect(() => {
    applyRouteHead(location.pathname);
  }, [location.pathname]);

  // Only the playground is a fixed full-screen app. Content pages scroll the WINDOW: AdSense
  // re-checks deferred below-the-fold slots on window scroll, so a page scrolling inside its own
  // container never got those slots requested (Home, 2026-10-05). Mobile browsers also need
  // window scrolling to collapse the address bar.
  const isPlayground = location.pathname === '/playground';
  return (
    <div style={isPlayground
      ? { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }
      : { display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={isPlayground ? undefined : { position: 'sticky', top: 0, zIndex: 100 }}>
        <Navbar />
      </div>
      <div style={isPlayground ? { flex: 1, overflow: 'hidden', position: 'relative' } : { flex: 1, position: 'relative' }}>
        {/* Keyed by path so navigating away from a crashed page recovers. */}
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/"           element={<Pages.Home />} />
              <Route path="/components" element={<Pages.Components />} />
              <Route path="/lessons"    element={<Pages.Lessons />} />
              <Route path="/playground" element={playgroundShell ? <RouteFallback /> : <Pages.Playground />} />
              <Route path="/privacy"    element={<Pages.Privacy />} />
              <Route path="*"           element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
