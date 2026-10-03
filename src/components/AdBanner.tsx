import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Publisher id; the env var overrides it, the fallback keeps production unchanged. */
const ADSENSE_CLIENT: string =
  import.meta.env.VITE_ADSENSE_PUB_ID || 'ca-pub-4792941984956312';

interface AdBannerProps {
  slot: string;
  format?: string;
  style?: React.CSSProperties;
}

/** An AdSense slot that stays collapsed until Google reports it filled. */
export function AdBanner({ slot, format = 'auto', style }: AdBannerProps) {
  const initialized = useRef(false);
  const insRef = useRef<HTMLModElement>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const ins = insRef.current;
    if (!ins) return;

    const observer = new MutationObserver(() => {
      setFilled(ins.getAttribute('data-ad-status') === 'filled');
    });
    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      (window.adsbygoogle ||= []).push({});
    } catch {
      // ad blocker or script not loaded — the slot simply stays collapsed
    }
  }, []);

  return (
    <div style={{ display: filled ? 'block' : 'none', ...style }}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
