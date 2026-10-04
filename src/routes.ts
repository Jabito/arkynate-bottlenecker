import { createElement, lazy, type ComponentType } from 'react';
import { normalizePath } from './lib/routeMeta';

/*
 * Route-level code splitting: Home, Components and Lessons visitors don't download React Flow.
 *
 * Each page is React.lazy, plus a cache that preloadRoute() fills. A cached page renders
 * synchronously instead of suspending, which the prerender needs (renderToString can't wait for
 * a lazy chunk) and so does the client's first render (hydrating the prerendered HTML needs the
 * real page, not the Suspense fallback). Pages reached later by navigation load the usual way.
 */
type Loader = () => Promise<{ default: ComponentType }>;

const resolved = new Map<Loader, ComponentType>();

function lazyPage(loader: Loader): ComponentType {
  const Lazy = lazy(loader);
  // The cache is filled at most once per loader, before the first render that needs it.
  return function LazyPage() {
    return createElement(resolved.get(loader) ?? Lazy);
  };
}

const loaders = {
  '/':           () => import('./pages/HomePage'),
  '/components': () => import('./pages/ComponentsPage'),
  '/lessons':    () => import('./pages/LessonsPage'),
  '/playground': () => import('./pages/PlaygroundPage'),
  '/privacy':    () => import('./pages/PrivacyPage'),
} satisfies Record<string, Loader>;

export const Pages = {
  Home:       lazyPage(loaders['/']),
  Components: lazyPage(loaders['/components']),
  Lessons:    lazyPage(loaders['/lessons']),
  Playground: lazyPage(loaders['/playground']),
  Privacy:    lazyPage(loaders['/privacy']),
};

/** Loads the page chunk for `pathname` so it renders without suspending. No-op for unknown paths. */
export async function preloadRoute(pathname: string): Promise<void> {
  const loader: Loader | undefined = loaders[normalizePath(pathname) as keyof typeof loaders];
  if (!loader || resolved.has(loader)) return;
  try {
    resolved.set(loader, (await loader()).default);
  } catch {
    // A failed chunk falls through to React.lazy, which retries and reports through the ErrorBoundary.
  }
}
