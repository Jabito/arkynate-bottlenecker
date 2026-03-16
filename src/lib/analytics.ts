const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function restHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY ?? '',
    Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
  };
}

/** Fire-and-forget — inserts an event_type row in playground_stats. */
export function trackEvent(eventType: string): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  fetch(`${SUPABASE_URL}/rest/v1/playground_stats`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ event_type: eventType }),
  }).catch(() => {});
}

/** Returns the total count for a given event_type. Returns 0 on any error. */
export async function getEventCount(eventType: string): Promise<number> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return 0;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/playground_stats?event_type=eq.${encodeURIComponent(eventType)}&select=id`,
      {
        headers: {
          ...restHeaders(),
          Prefer: 'count=exact',
          'Range-Unit': 'items',
          Range: '0-0',
        },
      },
    );
    const contentRange = res.headers.get('Content-Range');
    if (contentRange) {
      const total = contentRange.split('/')[1];
      return parseInt(total, 10) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}
