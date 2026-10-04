import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useDiagramStore } from '../store/diagramStore';
import { applyTheme, useThemeStore } from '../store/themeStore';
import { TEMPLATES } from '../data/templates';
import { ThemePicker } from './ThemePicker';

const SITE = 'https://bottlenecker.arkynate.com';
const SUPPORT_URL = 'https://www.paypal.com/paypalme/kingJabito';
const ISSUES_URL = 'https://github.com/Jabito/arkynate-bottlenecker/issues';
const ABOUT_URL = 'https://arkynate.com/';
const CONTACT_URL = 'https://arkynate.com/contact';

// Same threshold as PlaygroundPage's "Desktop Required" screen (innerWidth < 768).
const MQ_DESKTOP_REQUIRED = '(max-width: 767px)';
const MQ_COMPACT = '(max-width: 1279px)';
const MQ_TIGHT = '(max-width: 1023px)';
const MQ_PHONE = '(max-width: 639px)';

type MenuId = 'templates' | 'save' | 'load' | 'export' | 'more';

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
  fontSize: 12,
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: 500,
  padding: '5px 10px',
  borderRadius: 6,
  textDecoration: 'none',
  transition: 'color 0.15s',
  whiteSpace: 'nowrap',
  background: isActive ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : undefined,
});

const MENU_ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]';

/**
 * A trigger button plus its popover. Closes on Esc (focus returns to the
 * trigger) and on any outside click; arrow keys move between menu items (#53).
 */
function Popover({
  id, open, onToggle, onClose, label, trigger, kind = 'menu', width, disabled, busy, children,
}: {
  id: MenuId;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  label: string;
  trigger: React.ReactNode;
  kind?: 'menu' | 'dialog';
  width: number;
  disabled?: boolean;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]')
      ?? panel?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
      triggerRef.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        className="bn-navbtn"
        aria-haspopup={kind}
        aria-expanded={open}
        aria-controls={open ? `bn-menu-${id}` : undefined}
        aria-busy={busy || undefined}
        disabled={disabled}
        onClick={onToggle}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={`bn-menu-${id}`}
          role={kind}
          aria-label={label}
          className="bn-menu scrollbar-thin"
          style={{ width, maxHeight: 'calc(100vh - 70px)', overflowY: 'auto' }}
          onKeyDown={onPanelKeyDown}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface PendingConfirm {
  text: string;
  confirmLabel: string;
  run: () => void;
}

function formatSavedAt(savedAt: unknown): string | null {
  if (typeof savedAt !== 'number' && typeof savedAt !== 'string') return null;
  const d = new Date(savedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function Navbar() {
  const {
    diagramName, setDiagramName, isDirty, notice, notify,
    newDiagram, saveDiagram, loadDiagram, deleteDiagram,
    exportJSON, exportPNG, exportJPG, importJSON, loadTemplate,
    savedDiagrams,
  } = useDiagramStore(useShallow(s => ({
    diagramName: s.diagramName,
    setDiagramName: s.setDiagramName,
    isDirty: s.isDirty,
    notice: s.notice,
    notify: s.notify,
    newDiagram: s.newDiagram,
    saveDiagram: s.saveDiagram,
    loadDiagram: s.loadDiagram,
    deleteDiagram: s.deleteDiagram,
    exportJSON: s.exportJSON,
    exportPNG: s.exportPNG,
    exportJPG: s.exportJPG,
    importJSON: s.importJSON,
    loadTemplate: s.loadTemplate,
    savedDiagrams: s.savedDiagrams,
  })));
  const theme = useThemeStore(s => s.theme);

  const location = useLocation();
  const isPlayground = location.pathname === '/playground';
  const desktopRequired = useMediaQuery(MQ_DESKTOP_REQUIRED);
  const compact = useMediaQuery(MQ_COMPACT);
  const tight = useMediaQuery(MQ_TIGHT);
  const phone = useMediaQuery(MQ_PHONE);

  // Playground actions only where the canvas is usable (#69).
  const showActions = isPlayground && !desktopRequired;
  // What collapses into the overflow menu as the bar narrows (#31).
  const actionsInMenu = showActions && compact;
  const linksInMenu = phone || (showActions && tight);

  const [menu, setMenu] = useState<MenuId | null>(null);
  const [saveName, setSaveName] = useState('');
  const [overwriteName, setOverwriteName] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'PNG' | 'JPG' | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [hiddenNoticeId, setHiddenNoticeId] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const savedNames = Object.keys(savedDiagrams);

  // Themes apply on the playground only; content pages stay on the dark tokens (#17).
  useEffect(() => {
    applyTheme(isPlayground ? theme : 'dark');
  }, [isPlayground, theme]);

  // Per-route canonical + og:url (#21).
  useEffect(() => {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const url = SITE + path; // unknown paths render a noindex 404, not a duplicate of Home
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', url);
  }, [location.pathname]);

  // Close menus and pending confirms on navigation.
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setMenu(null);
    setPending(null);
  }

  // Toast: the store owns the notice; we hide each one by id, longer ones stay longer.
  const noticeVisible = notice != null && notice.id !== hiddenNoticeId;
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setHiddenNoticeId(notice.id), notice.text.length > 40 ? 5000 : 2500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!pending) return;
    confirmCancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPending(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending]);

  const closeMenu = useCallback(() => {
    setMenu(null);
    setOverwriteName(null);
    setDeleteName(null);
  }, []);
  const toggle = (id: MenuId) => () => {
    setOverwriteName(null);
    setDeleteName(null);
    setMenu(m => (m === id ? null : id));
  };

  /** Runs a canvas-replacing action, asking first when there are unsaved changes (#10). */
  const guard = (what: string, confirmLabel: string, run: () => void) => {
    closeMenu();
    if (!isDirty) { run(); return; }
    setPending({
      text: `Replace “${diagramName}” with ${what}? Its unsaved changes stay reachable with Undo (⌘Z).`,
      confirmLabel,
      run,
    });
  };

  // Replace actions announce themselves (with an undo hint) through the store notice.
  const handleNew = () => guard('a blank diagram', 'Start new', newDiagram);

  const handleTemplate = (t: (typeof TEMPLATES)[number]) =>
    guard(`the “${t.name}” template`, 'Load template', () => loadTemplate(t));

  const handleLoad = (name: string) =>
    guard(`saved diagram “${name}”`, 'Load', () => loadDiagram(name));

  const doSave = (name: string) => {
    saveDiagram(name);
    setSaveName('');
    closeMenu();
    notify(`Saved “${name}” in this browser`);
  };

  const handleSave = () => {
    const name = saveName.trim() || diagramName;
    if (name !== diagramName && savedNames.includes(name)) {
      setOverwriteName(name);
      return;
    }
    doSave(name);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = String(ev.target?.result ?? '');
      guard(`“${file.name}”`, 'Import', () => {
        const res = importJSON(text);
        if (!res.ok) notify(`Import failed: ${res.error}`);
      });
    };
    reader.onerror = () => notify(`Could not read “${file.name}”`);
    reader.readAsText(file);
  };

  const handleExportImage = async (kind: 'PNG' | 'JPG') => {
    closeMenu();
    setExporting(kind);
    notify(`Exporting ${kind}…`);
    try {
      await (kind === 'PNG' ? exportPNG() : exportJPG());
      notify(`${kind} exported`);
    } catch {
      notify(`${kind} export failed`);
    } finally {
      setExporting(null);
    }
  };

  const navLinks = (
    <>
      <NavLink to="/"           style={navLinkStyle} end>Home</NavLink>
      <NavLink to="/components" style={navLinkStyle}>Components</NavLink>
      <NavLink to="/lessons"    style={navLinkStyle}>Lessons</NavLink>
      <NavLink to="/playground" style={navLinkStyle}>Playground</NavLink>
    </>
  );

  const divider = <div aria-hidden style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />;

  return (
    <>
      <header
        style={{
          height: 50,
          background: 'var(--bg-nav)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: compact ? '0 10px' : '0 16px',
          gap: compact ? 4 : 8,
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        {/* Logo → Home (#86) */}
        <Link
          to="/"
          aria-label="Bottlenecker home"
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4, textDecoration: 'none', flexShrink: 0 }}
        >
          <img src="/favicon.svg" alt="" width={22} height={22} style={{ display: 'block' }} />
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1 }}>
              Bottlenecker
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1, marginTop: 2 }}>
              by Arkynate Labs · v{__APP_VERSION__}
            </div>
          </div>
        </Link>

        {!linksInMenu && (
          <>
            {divider}
            <nav aria-label="Main" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {navLinks}
            </nav>
          </>
        )}

        {showActions && (
          <>
            {divider}
            <input
              value={diagramName}
              onChange={e => setDiagramName(e.target.value)}
              aria-label="Diagram name"
              title={diagramName}
              className="bn-diagram-name"
            />
          </>
        )}

        <div style={{ flex: 1 }} />

        {showActions && (
          <>
            {!actionsInMenu && <button className="bn-navbtn" onClick={handleNew}>New</button>}

            <Popover id="templates" label="Starter templates" width={260}
              open={menu === 'templates'} onToggle={toggle('templates')} onClose={closeMenu}
              trigger="Templates ▾">
              <div className="bn-menu-label">Starter templates</div>
              {TEMPLATES.map(t => (
                <button key={t.name} role="menuitem" className="bn-menuitem" onClick={() => handleTemplate(t)}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div className="bn-menuitem-sub">{t.description}</div>
                </button>
              ))}
            </Popover>

            <Popover id="save" label="Save diagram" kind="dialog" width={240}
              open={menu === 'save'} onToggle={toggle('save')} onClose={closeMenu}
              trigger="Save">
              {overwriteName ? (
                <div role="alert">
                  <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 10, lineHeight: 1.5 }}>
                    “{overwriteName}” already exists. Overwrite it with this canvas?
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="bn-btn-danger" style={{ flex: 1 }} onClick={() => doSave(overwriteName)}>Overwrite</button>
                    <button className="bn-btn-ghost" style={{ flex: 1 }} data-autofocus onClick={() => setOverwriteName(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <label htmlFor="bn-save-name" className="bn-menu-label" style={{ display: 'block' }}>Save as</label>
                  <input
                    id="bn-save-name"
                    data-autofocus
                    className="bn-input"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    placeholder={diagramName}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                    style={{ marginBottom: 8 }}
                  />
                  <button className="bn-btn-primary" style={{ width: '100%' }} onClick={handleSave}>Save</button>
                  <div className="bn-menuitem-sub" style={{ marginTop: 8 }}>Saved in this browser only.</div>
                </>
              )}
            </Popover>

            <Popover id="load" label="Saved diagrams" width={260}
              open={menu === 'load'} onToggle={toggle('load')} onClose={closeMenu}
              trigger="Load">
              <div className="bn-menu-label">Saved diagrams</div>
              {savedNames.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '0 4px 4px' }}>No saved diagrams yet.</div>
              ) : savedNames.map(name => {
                const d = savedDiagrams[name] as { nodes?: unknown[]; savedAt?: unknown };
                const count = Array.isArray(d.nodes) ? d.nodes.length : 0;
                const when = formatSavedAt(d.savedAt);
                if (deleteName === name) {
                  return (
                    <div key={name} role="alert" style={{ padding: '6px 4px', marginBottom: 4 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 6 }}>Delete “{name}”?</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="bn-btn-danger" style={{ flex: 1 }}
                          onClick={() => { deleteDiagram(name); setDeleteName(null); notify(`Deleted “${name}”`); }}>
                          Delete
                        </button>
                        <button className="bn-btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteName(null)}>Keep</button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <button role="menuitem" className="bn-menuitem" style={{ flex: 1, minWidth: 0 }} onClick={() => handleLoad(name)}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                      <div className="bn-menuitem-sub">
                        {count} node{count === 1 ? '' : 's'}{when ? ` · ${when}` : ''}
                      </div>
                    </button>
                    <button
                      role="menuitem"
                      aria-label={`Delete saved diagram “${name}”`}
                      title="Delete"
                      className="bn-menuitem"
                      onClick={() => setDeleteName(name)}
                      style={{ width: 30, height: 30, padding: 0, textAlign: 'center', color: 'var(--st-critical)', fontSize: 16, flexShrink: 0 }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </Popover>

            <Popover id="export" label="Export diagram" width={220}
              open={menu === 'export'} onToggle={toggle('export')} onClose={closeMenu}
              disabled={exporting !== null} busy={exporting !== null}
              trigger={exporting ? <><span className="bn-spinner" aria-hidden /> Exporting {exporting}…</> : 'Export ▾'}>
              <button role="menuitem" className="bn-menuitem" onClick={() => { closeMenu(); exportJSON(); }}>Export JSON</button>
              <button role="menuitem" className="bn-menuitem" onClick={() => handleExportImage('PNG')}>Export PNG</button>
              <button role="menuitem" className="bn-menuitem" onClick={() => handleExportImage('JPG')}>Export JPG</button>
              <div className="bn-menu-sep" />
              <div className="bn-menuitem-sub" style={{ padding: '2px 10px 4px' }}>Only JSON exports can be re-imported.</div>
            </Popover>

            {!actionsInMenu && (
              <>
                <button className="bn-navbtn" onClick={() => fileRef.current?.click()} title="Import a JSON export">Import</button>
                <ThemePicker />
              </>
            )}
            <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
          </>
        )}

        {/* Overflow menu: links (narrow), collapsed actions, privacy, issues, support (#29 #31 #90) */}
        <Popover id="more" label="More" width={220}
          open={menu === 'more'} onToggle={toggle('more')} onClose={closeMenu}
          trigger={linksInMenu ? 'Menu ☰' : 'More ▾'}>
          {linksInMenu && (
            <>
              {[
                { to: '/', label: 'Home' },
                { to: '/components', label: 'Components' },
                { to: '/lessons', label: 'Lessons' },
                { to: '/playground', label: 'Playground' },
              ].map(l => (
                <Link key={l.to} to={l.to} role="menuitem" className="bn-menuitem" onClick={closeMenu}
                  aria-current={location.pathname === l.to ? 'page' : undefined}
                  style={location.pathname === l.to ? { color: 'var(--accent)' } : undefined}>
                  {l.label}
                </Link>
              ))}
              <div className="bn-menu-sep" />
            </>
          )}
          {actionsInMenu && (
            <>
              <button role="menuitem" className="bn-menuitem" onClick={handleNew}>New diagram</button>
              <button role="menuitem" className="bn-menuitem" onClick={() => { closeMenu(); fileRef.current?.click(); }}>Import JSON…</button>
              <div className="bn-menu-sep" />
              <ThemePicker inMenu />
              <div className="bn-menu-sep" />
            </>
          )}
          <Link to="/privacy" role="menuitem" className="bn-menuitem" onClick={closeMenu}>Privacy</Link>
          <a href={ABOUT_URL} target="_blank" rel="noopener noreferrer" role="menuitem" className="bn-menuitem" onClick={closeMenu}>
            About Arkynate Labs ↗
          </a>
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" role="menuitem" className="bn-menuitem" onClick={closeMenu}>
            Contact ↗
          </a>
          <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" role="menuitem" className="bn-menuitem" onClick={closeMenu}>
            Report an issue ↗
          </a>
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" role="menuitem" className="bn-menuitem" onClick={closeMenu}>
            ☕ Support Bottlenecker ↗
          </a>
        </Popover>
      </header>

      {/* Inline confirm for canvas-replacing actions (#10) */}
      {pending && (
        <div
          role="alertdialog"
          aria-label="Replace the current diagram?"
          aria-describedby="bn-confirm-text"
          style={{
            position: 'fixed', top: 58, left: '50%', transform: 'translateX(-50%)',
            width: 'min(520px, calc(100vw - 32px))',
            background: 'var(--bg-surface)', border: '1px solid var(--st-warning)', borderRadius: 10,
            color: 'var(--text)', padding: '12px 14px', zIndex: 1001,
            boxShadow: '0 8px 32px var(--shadow)',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
          }}
        >
          <div id="bn-confirm-text" style={{ flex: '1 1 260px', fontSize: 13, lineHeight: 1.5 }}>{pending.text}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="bn-btn-primary" onClick={() => { const run = pending.run; setPending(null); run(); }}>
              {pending.confirmLabel}
            </button>
            <button ref={confirmCancelRef} className="bn-btn-ghost" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Toast — top centre, clear of the analysis bar (#67) */}
      <div role="status" aria-live="polite" style={{
        position: 'fixed', top: 58, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
        pointerEvents: 'none', width: 'max-content', maxWidth: 'min(560px, calc(100vw - 32px))',
      }}>
        {noticeVisible && !pending && (
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: 8,
            color: 'var(--text)', fontSize: 13, fontFamily: "'Space Grotesk', sans-serif",
            padding: '8px 20px', boxShadow: '0 4px 24px var(--shadow)',
            lineHeight: 1.45, textAlign: 'center',
          }}>
            {notice.text}
          </div>
        )}
      </div>
    </>
  );
}
