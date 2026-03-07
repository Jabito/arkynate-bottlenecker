import { useEffect, useRef } from 'react';

interface AdBannerProps {
  slot: string;
  format?: string;
  style?: React.CSSProperties;
}

export function AdBanner({ slot, format = 'auto', style }: AdBannerProps) {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try { ((window as any).adsbygoogle ||= []).push({}); } catch {}
  }, []);
  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', ...style }}
      data-ad-client="ca-pub-4792941984956312"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
