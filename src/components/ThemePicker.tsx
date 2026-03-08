import { useState } from 'react';
import { useThemeStore } from '../store/themeStore';
import type { Theme } from '../store/themeStore';

const THEMES: { id: Theme; name: string; bg: string; accent: string }[] = [
  { id: 'dark',   name: 'Dark',   bg: '#0a0f1e', accent: '#22d3ee' },
  { id: 'light',  name: 'Light',  bg: '#f8fafc', accent: '#0891b2' },
  { id: 'matrix', name: 'Matrix', bg: '#001400', accent: '#00ff41' },
];

export function ThemePicker() {
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);

  const current = THEMES.find(t => t.id === theme) ?? THEMES[0];

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(s => !s)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: hov ? '#1a2235' : 'transparent',
          border: `1px solid ${hov ? '#1e2d45' : 'transparent'}`,
          borderRadius: 6,
          color: '#94a3b8',
          padding: '5px 12px',
          fontSize: 12,
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: current.accent,
          display: 'inline-block',
          flexShrink: 0,
          boxShadow: `0 0 6px ${current.accent}`,
        }} />
        Theme
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: '#111827',
            border: '1px solid #1e2d45',
            borderRadius: 8,
            padding: 8,
            width: 160,
            zIndex: 50,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, padding: '0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Color theme
            </div>
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); setOpen(false); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  background: t.id === theme ? '#1a2235' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: t.id === theme ? '#f1f5f9' : '#94a3b8',
                  fontSize: 12,
                  fontFamily: "'Space Grotesk', sans-serif",
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (t.id !== theme) e.currentTarget.style.background = '#1a2235'; }}
                onMouseLeave={e => { if (t.id !== theme) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  background: t.bg,
                  border: `2px solid ${t.accent}`,
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                {t.name}
                {t.id === theme && (
                  <span style={{ marginLeft: 'auto', color: '#22d3ee', fontSize: 11 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
