import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { trackEvent } from './lib/analytics';

// Route-level code splitting: Home, Components and Lessons visitors don't download React Flow.
const HomePage       = lazy(() => import('./pages/HomePage'));
const ComponentsPage = lazy(() => import('./pages/ComponentsPage'));
const LessonsPage    = lazy(() => import('./pages/LessonsPage'));
const PlaygroundPage = lazy(() => import('./pages/PlaygroundPage'));
const PrivacyPage    = lazy(() => import('./pages/PrivacyPage'));

function RouteFallback() {
  return <div aria-busy="true" style={{ height: '100%', background: 'var(--bg-base)' }} />;
}

/** Real "not found" page instead of a silent redirect home (soft 404s). React 19 hoists the meta to <head>. */
function NotFound() {
  useEffect(() => {
    document.title = 'Page not found | Bottlenecker';
  }, []);
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
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

export default function App() {
  const location = useLocation();

  useEffect(() => {
    trackEvent('page_view');
  }, [location.pathname]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      <Navbar />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Keyed by path so navigating away from a crashed page recovers. */}
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/"           element={<HomePage />} />
              <Route path="/components" element={<ComponentsPage />} />
              <Route path="/lessons"    element={<LessonsPage />} />
              <Route path="/playground" element={<PlaygroundPage />} />
              <Route path="/privacy"    element={<PrivacyPage />} />
              <Route path="*"           element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
