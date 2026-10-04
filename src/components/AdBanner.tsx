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
 * While pending, unfilled or blocked (script never loaded, e.g. an ad blocker) the wrapper
 * collapses to zero HEIGHT but keeps its width. Never hide a slot with display:none: AdSense
 * measures width 0 and never requests an ad (no ads served 2026-03-17 → 2026-10-03). A
 * zero-height slot inside the viewport is still requested immediately (verified on live).
 *
 * The slot is pushed to AdSense only when it comes within 200 px of the viewport, so off-screen
 * slots never depend on AdSense's own deferred loading.
 */
export function AdBanner({ slot, size, style, onFilledChange }: AdBannerProps) {
  const initialized = useRef(false);
  const insRef = useRef<HTMLModElement>(null);
  const [status, setStatus] = useState<'pending' | 'filled' | 'unfilled' | 'blocked'>('pending');

  useEffect(() => {
    const ins = insRef.current;
    if (!ins) return;

    const observer = new MutationObserver(() => {
      const adStatus = ins.getAttribute('data-ad-status');
      if (adStatus !== 'filled' && adStatus !== 'unfilled') return;
      setStatus(adStatus);
      onFilledChange?.(adStatus === 'filled');
    });
    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => observer.disconnect();
  }, [onFilledChange]);

  // Hand the slot to AdSense only once it is about to be visible (zero-area targets still report
  // isIntersecting when inside the root, so the collapsed wrapper works as the target).
  useEffect(() => {
    if (initialized.current) return;
    const wrapper = insRef.current?.parentElement;
    if (!wrapper) return;
    let timer: number | undefined;

    const activate = () => {
      if (initialized.current) return;
      initialized.current = true;
      try {
        (window.adsbygoogle ||= []).push({});
      } catch {
        setStatus('blocked');
        return;
      }
      // adsbygoogle.js sets `loaded` once it runs; if it never does, the script was blocked.
      timer = window.setTimeout(() => {
        if (!(window.adsbygoogle as { loaded?: boolean } | undefined)?.loaded) {
          setStatus(s => (s === 'pending' ? 'blocked' : s));
        }
      }, 3000);
    };

    if (typeof IntersectionObserver === 'undefined') {
      activate();
      return () => window.clearTimeout(timer);
    }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        io.disconnect();
        activate();
      }
    }, { rootMargin: '200px 0px' });
    io.observe(wrapper);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const wrapperStyle: React.CSSProperties =
    status === 'filled' ? { textAlign: 'center', ...style }
    : { height: 0, overflow: 'hidden', textAlign: 'center' };

  return (
    <div data-ad-wrapper={slot} data-ad-state={status} style={wrapperStyle}>
      {status === 'filled' && <div className="bn-ad-label">Advertisement</div>}
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
