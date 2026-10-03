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
  /** Called when Google reports the slot filled or unfilled. */
  onFilledChange?: (filled: boolean) => void;
}

/** An AdSense slot that stays collapsed until Google reports it filled. */
export function AdBanner({ slot, format = 'auto', style, onFilledChange }: AdBannerProps) {
  const initialized = useRef(false);
  const insRef = useRef<HTMLModElement>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const ins = insRef.current;
    if (!ins) return;

    const observer = new MutationObserver(() => {
      const isFilled = ins.getAttribute('data-ad-status') === 'filled';
      setFilled(isFilled);
      onFilledChange?.(isFilled);
    });
    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => observer.disconnect();
  }, [onFilledChange]);

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
    // NOTE: display:none hides the slot from AdSense's width check, so it is likely never
    // requested; see docs/elevate/2026-10-03-owner-actions.md §5 before changing this.
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
