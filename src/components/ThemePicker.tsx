import { useEffect, useRef, useState } from 'react';
import { useThemeStore } from '../store/themeStore';
import type { Theme } from '../store/themeStore';

// Swatches preview each theme, so they keep that theme's own literal colours.
const THEMES: { id: Theme; name: string; bg: string; accent: string }[] = [
  { id: 'dark',   name: 'Dark',   bg: '#0a0f1e', accent: '#22d3ee' },
  { id: 'light',  name: 'Light',  bg: '#f8fafc', accent: '#0891b2' },
  { id: 'matrix', name: 'Matrix', bg: '#001400', accent: '#00ff41' },
];

export function ThemePicker({ inMenu = false }: { inMenu?: boolean }) {
  const theme = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = THEMES.find(t => t.id === theme) ?? THEMES[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const options = THEMES.map(t => (
    <button
      key={t.id}
      role="menuitemradio"
      aria-checked={t.id === theme}
      className="bn-menuitem"
      onClick={() => { setTheme(t.id); setOpen(false); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: t.id === theme ? 'var(--bg-elevated)' : undefined,
        color: t.id === theme ? 'var(--text-strong)' : 'var(--text-muted)',
      }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: 3, background: t.bg,
        border: `2px solid ${t.accent}`, display: 'inline-block', flexShrink: 0,
      }} />
      {t.name}
      {t.id === theme && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 11 }}>✓</span>}
    </button>
  ));

  // Inside an overflow menu: render the options inline, no nested popover.
  if (inMenu) {
    return (
      <div role="group" aria-label="Colour theme">
        <div className="bn-menu-label" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
          Colour theme
        </div>
        {options}
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        className="bn-navbtn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Colour theme: ${current.name}`}
        onClick={() => setOpen(s => !s)}
        style={{ gap: 6 }}
      >
        <span style={{
          width: 10, height: 10, borderRadius: '50%', background: current.accent,
          display: 'inline-block', flexShrink: 0, boxShadow: `0 0 6px ${current.accent}`,
        }} />
        Theme
      </button>

      {open && (
        <div role="menu" aria-label="Colour theme" className="bn-menu" style={{ width: 160 }}>
          <div className="bn-menu-label" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
            Colour theme
          </div>
          {options}
        </div>
      )}
    </div>
  );
}
