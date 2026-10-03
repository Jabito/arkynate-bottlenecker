import type { Template } from '../data/templates';

/** `?template=` key: the template's id when it has one, else its name as a slug ('Cached API' → 'cached-api'). */
export function templateKey(t: Template): string {
  const id = (t as Template & { id?: unknown }).id;
  return typeof id === 'string' && id ? id : t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Playground deep links for Home, Lessons, docs and social posts. */
export const templateHref = (t: Template) => `/playground?template=${encodeURIComponent(templateKey(t))}`;
export const lessonHref = (lessonId: string) => `/playground?lesson=${encodeURIComponent(lessonId)}`;
