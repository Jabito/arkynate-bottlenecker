const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** The only event names the client may send. */
export const ANALYTICS_EVENTS = [
  'page_view',
  'analyze_click',
  'template_used',
  'export_json',
  'export_png',
  'export_jpg',
] as const;
export type AnalyticsEvent = typeof ANALYTICS_EVENTS[number];

const CONFIGURED = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
/** Dev builds never post: a contributor with real env vars must not write to the production table. */
const SENDING = CONFIGURED && import.meta.env.PROD;

/** Repeats of the same event inside this window collapse into one (a held ⌘Enter, StrictMode doubles). */
const DEBOUNCE_MS: Partial<Record<AnalyticsEvent, number>> = { analyze_click: 1500 };
const COUNT_TTL_MS = 10 * 60 * 1000;

const lastCall = new Map<AnalyticsEvent, number>();
const inflight = new Map<string, Promise<number>>();

function restHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY ?? '',
    Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
  };
}

/** Global Privacy Control or Do Not Track set, or not in a browser (the prerender): send nothing. */
function optedOut(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1';
}

/** Fire-and-forget: inserts one anonymous event_type row in playground_stats (no cookies, no ids). */
export function trackEvent(eventType: AnalyticsEvent): void {
  if (!SENDING || !ANALYTICS_EVENTS.includes(eventType) || optedOut()) return;

  const windowMs = DEBOUNCE_MS[eventType];
  if (windowMs) {
    const now = Date.now();
    const prev = lastCall.get(eventType) ?? 0;
    lastCall.set(eventType, now);
    if (now - prev < windowMs) return;
  }

  fetch(`${SUPABASE_URL}/rest/v1/playground_stats`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ event_type: eventType }),
    keepalive: true,
  }).catch(() => {});
}

function readCachedCount(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { n, at } = JSON.parse(raw) as { n: number; at: number };
    return Date.now() - at < COUNT_TTL_MS && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeCachedCount(key: string, n: number): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ n, at: Date.now() }));
  } catch {
    // sessionStorage unavailable: the next visit fetches again
  }
}

async function fetchCount(eventType: AnalyticsEvent): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/playground_stats?event_type=eq.${encodeURIComponent(eventType)}&select=id`,
    {
      headers: {
        ...restHeaders(),
        Prefer: 'count=estimated',
        'Range-Unit': 'items',
        Range: '0-0',
      },
    },
  );
  const contentRange = res.headers.get('Content-Range');
  const total = contentRange ? parseInt(contentRange.split('/')[1], 10) : NaN;
  return Number.isFinite(total) ? total : 0;
}

/**
 * Approximate total for an event_type, cached per tab for 10 minutes so page visits
 * don't each run a count query. Returns 0 on any error.
 */
export async function getEventCount(eventType: AnalyticsEvent): Promise<number> {
  if (!CONFIGURED || typeof window === 'undefined') return 0;
  const key = `bn-count:${eventType}`;
  const cached = readCachedCount(key);
  if (cached !== null) return cached;

  let p = inflight.get(key);
  if (!p) {
    p = fetchCount(eventType)
      .then(n => {
        if (n > 0) writeCachedCount(key, n);
        return n;
      })
      .catch(() => 0)
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}
