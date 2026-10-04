import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Publisher id; the env var overrides it, the fallback keeps production unchanged. */
const ADSENSE_CLIENT: string =
  import.meta.env.VITE_ADSENSE_PUB_ID || 'ca-pub-4792941984956312';

/**
 * Ads on /playground (palette, config panel, under the canvas) are off while AdSense reviews the
 * site: a tool screen with little text and several ads risks "ads on screens without publisher
 * content". Set to true once arkynate.com is approved — see CLAUDE.md "Ads".
 */
export const PLAYGROUND_ADS_ENABLED = false;

/** Standard AdSense display sizes used on the site. */
export const AD_SIZES = {
  mediumRectangle: { width: 300, height: 250 },
  smallSquare:     { width: 200, height: 200 },
  leaderboard:     { width: 728, height: 90 },
} as const;

interface AdBannerProps {
  slot: string;
  /** Fixed slot size. Fixed-size units never resize their parents, unlike responsive ones. */
  size: { width: number; height: number };
  /** Wrapper style, applied once the slot is filled. */
  style?: React.CSSProperties;
  /** Called when Google reports the slot filled or unfilled. */
  onFilledChange?: (filled: boolean) => void;
}

/**
 * A fixed-size AdSense slot that takes no space until Google reports it filled (ruling 5).
 *
 * While unfilled the wrapper collapses to zero HEIGHT but keeps its width. Never use
 * display:none here: AdSense measures the slot's available width before requesting an ad,
 * and a hidden slot (width 0) is never requested at all (live slots sat unrequested from
 * 2026-03-17 to 2026-10-03 for this reason).
 */
export function AdBanner({ slot, size, style, onFilledChange }: AdBannerProps) {
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
    <div
      data-ad-wrapper={slot}
      style={filled
        ? { textAlign: 'center', ...style }
        : { height: 0, overflow: 'hidden', textAlign: 'center' }}
    >
      {filled && <div className="bn-ad-label">Advertisement</div>}
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: size.width, height: size.height }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
      />
    </div>
  );
}
