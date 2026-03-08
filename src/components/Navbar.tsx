import { useRef, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useDiagramStore } from '../store/diagramStore';
import { TEMPLATES } from '../data/templates';
import { ThemePicker } from './ThemePicker';

function NavBtn({
  children, onClick, title, danger,
}: { children: React.ReactNode; onClick: () => void; title?: string; danger?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (danger ? '#7f1d1d' : '#1a2235') : 'transparent',
        border: `1px solid ${hov ? (danger ? '#ef4444' : '#1e2d45') : 'transparent'}`,
        borderRadius: 6,
        color: hov && danger ? '#ef4444' : '#94a3b8',
        padding: '5px 12px',
        fontSize: 12,
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  color: isActive ? '#22d3ee' : '#94a3b8',
  fontSize: 12,
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: 500,
  padding: '5px 10px',
  borderRadius: 6,
  textDecoration: 'none',
  transition: 'color 0.15s',
  whiteSpace: 'nowrap' as const,
  ...(isActive ? { background: 'rgba(34,211,238,0.08)' } : {}),
});

export function Navbar() {
  const {
    diagramName, setDiagramName,
    newDiagram, saveDiagram, loadDiagram, deleteDiagram, exportJSON, exportPNG, exportJPG, importJSON,
    loadTemplate,
    savedDiagrams,
  } = useDiagramStore();

  const location = useLocation();
  const isPlayground = location.pathname === '/playground';

  const [showSaveMenu,      setShowSaveMenu]      = useState(false);
  const [showLoadMenu,      setShowLoadMenu]       = useState(false);
  const [showTemplateMenu,  setShowTemplateMenu]   = useState(false);
  const [showExportMenu,    setShowExportMenu]     = useState(false);
  const [saveName,          setSaveName]           = useState('');
  const [toastMsg,          setToastMsg]           = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedNames = Object.keys(savedDiagrams);

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const handleSave = () => {
    const name = saveName.trim() || diagramName;
    saveDiagram(name);
    setSaveName('');
    setShowSaveMenu(false);
    showToast('Saved to browser');
  };

  const handleLoad = (name: string) => {
    loadDiagram(name);
    setShowLoadMenu(false);
    showToast('Diagram loaded');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      importJSON(ev.target?.result as string);
      showToast('Imported successfully');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const closeAll = () => {
    setShowSaveMenu(false);
    setShowLoadMenu(false);
    setShowTemplateMenu(false);
    setShowExportMenu(false);
  };

  return (
    <>
      <div
        style={{
          height: 50,
          background: '#0d1526',
          borderBottom: '1px solid #1e2d45',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 8,
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
          <span style={{ fontSize: 20 }}>🔩</span>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>
              Bottlenecker
            </div>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>
              by Arkynate Labs · v{__APP_VERSION__}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: '#1e2d45', flexShrink: 0 }} />

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NavLink to="/"           style={navLinkStyle} end>Home</NavLink>
          <NavLink to="/components" style={navLinkStyle}>Components</NavLink>
          <NavLink to="/playground" style={navLinkStyle}>Playground</NavLink>
        </nav>

        {/* Diagram name — playground only */}
        {isPlayground && (
          <>
            <div style={{ width: 1, height: 20, background: '#1e2d45', flexShrink: 0, marginLeft: 4 }} />
            <input
              value={diagramName}
              onChange={e => setDiagramName(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #1e2d45',
                color: '#e2e8f0',
                fontSize: 13,
                padding: '2px 4px',
                outline: 'none',
                width: 160,
                fontFamily: "'Inter', sans-serif",
                flexShrink: 0,
              }}
              onFocus={e => { e.currentTarget.style.borderBottomColor = '#22d3ee'; }}
              onBlur={e => { e.currentTarget.style.borderBottomColor = '#1e2d45'; }}
            />
          </>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Playground-only actions */}
        {isPlayground && (
          <>
            <NavBtn onClick={() => { closeAll(); if (confirm('Start a new diagram?')) newDiagram(); }}>New</NavBtn>

            {/* Templates */}
            <div style={{ position: 'relative' }}>
              <NavBtn onClick={() => { setShowTemplateMenu(s => !s); setShowSaveMenu(false); setShowLoadMenu(false); }}>
                Templates ▾
              </NavBtn>
              {showTemplateMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
                  padding: 8, width: 260, zIndex: 50,
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, padding: '0 4px' }}>Starter templates</div>
                  {TEMPLATES.map(t => (
                    <button
                      key={t.name}
                      onClick={() => {
                        loadTemplate(t);
                        setShowTemplateMenu(false);
                        showToast(`Template "${t.name}" loaded`);
                      }}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', borderRadius: 6,
                        color: '#e2e8f0', padding: '8px 10px', fontSize: 12, cursor: 'pointer',
                        textAlign: 'left', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1a2235'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, marginBottom: 2 }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{t.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Save */}
            <div style={{ position: 'relative' }}>
              <NavBtn onClick={() => { setShowSaveMenu(s => !s); setShowLoadMenu(false); setShowTemplateMenu(false); }}>Save</NavBtn>
              {showSaveMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
                  padding: 12, width: 220, zIndex: 50,
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Save as</div>
                  <input
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    placeholder={diagramName}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                    style={{
                      width: '100%', background: '#0a0f1e', border: '1px solid #1e2d45',
                      borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontSize: 12, outline: 'none',
                      marginBottom: 8,
                    }}
                  />
                  <button
                    onClick={handleSave}
                    style={{
                      width: '100%', background: '#0891b2', border: 'none', borderRadius: 6,
                      color: '#fff', padding: '6px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {/* Load */}
            <div style={{ position: 'relative' }}>
              <NavBtn onClick={() => { setShowLoadMenu(s => !s); setShowSaveMenu(false); setShowTemplateMenu(false); }}>Load</NavBtn>
              {showLoadMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
                  padding: 12, width: 220, maxHeight: 280, overflowY: 'auto', zIndex: 50,
                }} className="scrollbar-thin">
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Saved diagrams</div>
                  {savedNames.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#475569' }}>No saved diagrams yet.</div>
                  ) : savedNames.map(name => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <button
                        onClick={() => handleLoad(name)}
                        style={{
                          flex: 1, background: '#1a2235', border: '1px solid #1e2d45', borderRadius: 6,
                          color: '#e2e8f0', padding: '6px 8px', fontSize: 11, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {name}
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete "${name}"?`)) deleteDiagram(name); }}
                        style={{
                          background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 4,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Export */}
            <div style={{ position: 'relative' }}>
              <NavBtn onClick={() => { setShowExportMenu(s => !s); setShowSaveMenu(false); setShowLoadMenu(false); setShowTemplateMenu(false); }}>
                Export ▾
              </NavBtn>
              {showExportMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
                  padding: 8, width: 220, zIndex: 50,
                }}>
                  {[
                    { label: 'Export JSON', action: () => { exportJSON(); setShowExportMenu(false); } },
                    { label: 'Export PNG', action: () => { exportPNG(); setShowExportMenu(false); } },
                    { label: 'Export JPG', action: () => { exportJPG(); setShowExportMenu(false); } },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', borderRadius: 6,
                        color: '#e2e8f0', padding: '7px 10px', fontSize: 12, cursor: 'pointer',
                        textAlign: 'left', transition: 'background 0.1s',
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1a2235'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {item.label}
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid #1e2d45', margin: '6px 0' }} />
                  <div style={{ fontSize: 10, color: '#475569', padding: '4px 10px' }}>
                    ℹ️ Only JSON exports can be re-imported.
                  </div>
                  <div style={{ borderTop: '1px solid #1e2d45', margin: '6px 0' }} />
                  <a
                    href="https://www.paypal.com/paypalme/kingJabito"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block', padding: '7px 10px', fontSize: 11,
                      color: '#64748b', textDecoration: 'none', borderRadius: 6,
                      transition: 'color 0.15s, background 0.1s',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = '#1a2235'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    ☕ Enjoying Bottlenecker? Buy me a coffee →
                  </a>
                </div>
              )}
            </div>

            <NavBtn onClick={() => fileRef.current?.click()} title="Import JSON only">Import</NavBtn>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />

            <ThemePicker />
          </>
        )}

        <a
          href="https://www.paypal.com/paypalme/kingJabito"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 6,
            color: '#94a3b8',
            padding: '5px 12px',
            fontSize: 12,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#1a2235';
            e.currentTarget.style.borderColor = '#1e2d45';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          ☕ Support
        </a>

        <a
          href="mailto:jabito.javier@gmail.com?subject=Bottlenecker%20Issue"
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 6,
            color: '#94a3b8',
            padding: '5px 12px',
            fontSize: 12,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#1a2235';
            e.currentTarget.style.borderColor = '#1e2d45';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          Report an Issue
        </a>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#1a2235', border: '1px solid #22d3ee', borderRadius: 8,
          color: '#e2e8f0', fontSize: 13, fontFamily: "'Space Grotesk', sans-serif",
          padding: '8px 20px', zIndex: 1000,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          {toastMsg}
        </div>
      )}
    </>
  );
}
