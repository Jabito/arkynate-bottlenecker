import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  slot: string;
  format?: string;
  style?: React.CSSProperties;
}

export function AdBanner({ slot, format = 'auto', style }: AdBannerProps) {
  const initialized = useRef(false);
  const insRef = useRef<HTMLElement>(null);
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
    try { ((window as any).adsbygoogle ||= []).push({}); } catch {}
  }, []);

  return (
    <div style={{ display: filled ? 'block' : 'none', ...style }}>
      <ins
        ref={insRef as any}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-4792941984956312"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
