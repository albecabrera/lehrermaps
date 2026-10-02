import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { BugChecklistIcon } from './BugChecklist';
import { ONE_NOTE_APP_URL } from '../lib/externalApps';

// Shared icons for mobile navigation.
export const navIcons = {
  subjects: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M2 6a2 2 0 0 1 2-2h4l1.5 1.5H16a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  search: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M13.5 13.5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  schedule: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="4" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2.5 8h15M7 2v4M13 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  more: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="4.5" cy="10" r="1.6" fill="currentColor"/>
      <circle cx="10" cy="10" r="1.6" fill="currentColor"/>
      <circle cx="15.5" cy="10" r="1.6" fill="currentColor"/>
    </svg>
  ),
};

// Mobile Bottom-Navigation — Daumen-Zone statt überladener Top-Leiste.
// Wird als letztes Flex-Kind des App-Roots gerendert (nicht fixed),
// verdeckt daher nie Inhalt. items: [{ id, label, icon, onClick }]
export function MobileBottomNav({ accent, items, active }) {
  return (
    <nav style={{
      flexShrink: 0, display: 'flex',
      borderTop: '1px solid var(--c-border)',
      background: 'var(--c-surface)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {items.map((item) => {
        const on = active === item.id;
        return (
          <button
            key={item.id}
            onClick={item.onClick}
            aria-label={item.label}
            style={{
              flex: 1, height: 54, border: 'none', background: 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3, cursor: 'pointer',
              color: on ? accent : 'var(--c-text-3)', fontFamily: 'inherit',
              transition: 'color .15s',
            }}
          >
            {item.icon}
            <span className="lm-mobile-nav-label" style={{ fontSize: 10, fontWeight: on ? 700 : 500, letterSpacing: 0.2 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

const toolIcons = {
  tools: <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.6 5.1a5 5 0 0 0-6.5 6.5l-5.4 5.4a2 2 0 0 0 2.8 2.8l5.4-5.4a5 5 0 0 0 6.5-6.5l-3.3 3.3-3.3-3.3 3.8-2.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>,
  randomizer: <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/><circle cx="8" cy="8" r="1.25" fill="currentColor"/><circle cx="16" cy="8" r="1.25" fill="currentColor"/><circle cx="12" cy="12" r="1.25" fill="currentColor"/><circle cx="8" cy="16" r="1.25" fill="currentColor"/><circle cx="16" cy="16" r="1.25" fill="currentColor"/></svg>,
  reflection: <span className="lm-workspace-tools-dual-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="8" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v6m4-6v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></span>,
  timer: <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.8"/><path d="M12 13V8m0 5 3 2M9 2h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  hangman: <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h15M6 21V3h10v4"/><circle cx="16" cy="10" r="2"/><path d="M16 12v4m0-3-3 2m3-2 3 2m-3 1-2 3m2-3 2 3"/></svg>,
  qrCode: <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.7"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM5.5 5.5h2v2h-2zM16.5 5.5h2v2h-2zM5.5 16.5h2v2h-2zM14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M13 7l5 5-5 5m-9-5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

export function WorkspaceToolsMenu({ onRandomizer, onReflection, onClassroomTimer, onHangman, onQrCode, onBugChecklist, onLogout, onSelection, mobile = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const focusMenuOnOpenRef = useRef(true);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    if (focusMenuOnOpenRef.current) {
      rootRef.current?.querySelector('[role="menuitem"]')?.focus();
    }
    focusMenuOnOpenRef.current = true;
    const closeOnOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        window.clearTimeout(closeTimerRef.current);
        setOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(closeTimerRef.current);
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  const handlePointerEnter = (event) => {
    if (mobile || !['mouse', 'pen'].includes(event.pointerType)) return;
    window.clearTimeout(closeTimerRef.current);
    focusMenuOnOpenRef.current = false;
    setOpen(true);
  };

  const handlePointerLeave = (event) => {
    if (mobile || !['mouse', 'pen'].includes(event.pointerType)) return;
    if (rootRef.current?.querySelector('[role="menu"]')?.contains(document.activeElement)) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 180);
  };

  const handleTriggerClick = () => {
    window.clearTimeout(closeTimerRef.current);
    if (open) {
      setOpen(false);
      return;
    }
    focusMenuOnOpenRef.current = true;
    setOpen(true);
  };

  const selectItem = (action) => {
    window.clearTimeout(closeTimerRef.current);
    setOpen(false);
    action();
    onSelection?.();
  };

  const handleMenuKeyDown = (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]')];
    const current = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (current + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={`lm-workspace-tools-menu${mobile ? ' lm-mobile-tools-menu' : ''}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <button
        ref={triggerRef}
        className="lm-workspace-tool lm-workspace-tools-trigger"
        type="button"
        onClick={handleTriggerClick}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label="Tools"
        title="Tools"
      >
        {toolIcons.tools}
      </button>
      {open && (
        <div id={menuId} className="lm-workspace-tools-panel" role="menu" aria-label="Tools" onKeyDown={handleMenuKeyDown}>
          <button type="button" role="menuitem" aria-label="Zufallsgenerator" title="Zufallsgenerator" onClick={() => selectItem(onRandomizer)}>{toolIcons.randomizer}<span className="lm-workspace-tools-label">Zufallsgenerator</span></button>
          <button type="button" role="menuitem" aria-label="Koffer und Müllkorb" title="Koffer und Müllkorb" onClick={() => selectItem(onReflection)}>{toolIcons.reflection}<span className="lm-workspace-tools-label">Koffer &amp; Müllkorb</span></button>
          {onClassroomTimer && <button type="button" role="menuitem" aria-label="Klassenzeit" title="Klassenzeit" onClick={() => selectItem(onClassroomTimer)}>{toolIcons.timer}<span className="lm-workspace-tools-label">Klassenzeit</span></button>}
          {onHangman && <button type="button" role="menuitem" aria-label="Hangman" title="Hangman" onClick={() => selectItem(onHangman)}>{toolIcons.hangman}<span className="lm-workspace-tools-label">Hangman</span></button>}
          {onQrCode && <button type="button" role="menuitem" aria-label="QR-Code-Generator" title="QR-Code-Generator" onClick={() => selectItem(onQrCode)}>{toolIcons.qrCode}<span className="lm-workspace-tools-label">QR-Code</span></button>}
          {onBugChecklist && <button type="button" role="menuitem" aria-label="Bugs-Checkliste" title="Bugs-Checkliste" onClick={() => selectItem(onBugChecklist)}><BugChecklistIcon size={20} /><span className="lm-workspace-tools-label">Bugs-Checkliste</span></button>}
          {onLogout && <button type="button" role="menuitem" className="lm-workspace-tools-logout" aria-label="Abmelden" title="Abmelden" onClick={() => selectItem(onLogout)}>{toolIcons.logout}<span className="lm-workspace-tools-label">Abmelden</span></button>}
        </div>
      )}
    </div>
  );
}

// „Mehr"-Bottom-Sheet: alles, was auf Desktop in der Kopfleiste wohnt,
// aber mobil zu selten gebraucht wird, um Platz zu verdienen.
// Lehrer-Einträge (Termine/Upload/Arbeitsblatt/Notion/Miro) erscheinen nur,
// when the corresponding handlers are supplied.
// nutzt dasselbe Sheet nur mit Theme/Sprache/Abmelden.
export function MobileMoreSheet({
  open, onClose, t, accent,
  isDark, toggleTheme,
  onExams, onQuickAccess, onWorksheet, onUpload, uploadDisabled, onBugChecklist, onClassroomTimer, onHangman, onQrCode, onIdoceo, onUntis, onLogout,
  onRandomizer, onReflection,
  showWorkspaceTools = true,
  showTeacherLinks = false,
}) {
  useEscapeKey(open, onClose);
  if (!open) return null;

  const row = (label, onClick, { disabled = false, danger = false, icon = null, className = '' } = {}) => (
    <button
      onClick={() => { if (disabled) return; onClick(); onClose(); }}
      disabled={disabled}
      className={className}
      style={{
        width: '100%', minHeight: 46, border: 'none', borderRadius: 10,
        background: 'transparent', textAlign: 'left', fontFamily: 'inherit',
        fontSize: 14, fontWeight: 500, padding: '0 14px',
        color: danger ? 'var(--c-danger-text)' : 'var(--c-text)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <span style={{ width: 20, display: 'flex', justifyContent: 'center', color: danger ? 'inherit' : 'var(--c-text-2)' }}>{icon}</span>
      {label}
    </button>
  );

  const divider = <div style={{ height: 1, background: 'var(--c-border)', margin: '8px 6px' }} />;
  const hasActions = onExams || onUpload || onWorksheet || (showWorkspaceTools && onRandomizer && onReflection);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1500,
        background: 'var(--c-overlay)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end',
        animation: 'lmFadeIn .14s ease-out',
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      <div
        className="lm-modal-surface"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', background: 'var(--c-surface)',
          borderRadius: '18px 18px 0 0',
          border: '1px solid var(--c-border-soft)', borderBottom: 'none',
          boxShadow: 'var(--c-shadow-modal)',
          padding: '10px 10px calc(14px + env(safe-area-inset-bottom))',
          maxHeight: '75vh', overflowY: 'auto',
          animation: 'lmSlideUp .22s cubic-bezier(.4,.7,.3,1)',
        }}
      >
        {/* Grabber */}
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--c-border)', margin: '2px auto 10px' }} />

        {onQuickAccess && row('Schnellzugriff & Dokumente', onQuickAccess, { icon: '▣' })}
        {onExams && row('Termine', onExams, {
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="3" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          ),
        })}
        {onUpload && row(t('app.upload'), onUpload, {
          disabled: uploadDisabled,
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 11V3M4.5 6.5L8 3l3.5 3.5M2.5 13.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ),
        })}
        {onWorksheet && row('✦ Arbeitsblatt', onWorksheet)}
        {showWorkspaceTools && onRandomizer && onReflection && <WorkspaceToolsMenu onRandomizer={onRandomizer} onReflection={onReflection} onClassroomTimer={onClassroomTimer} onHangman={onHangman} onQrCode={onQrCode} onBugChecklist={onBugChecklist} onLogout={onLogout} onSelection={onClose} mobile />}

        {hasActions && divider}

        {showTeacherLinks && (
          <>
            {row('Notion', () => window.open('https://www.notion.so/acabreraes/Q1-Apuntes-36d29f35ce65804bb227ea3b08dbfc0e?source=copy_link', '_blank', 'noopener,noreferrer'), {
              icon: <span style={{ fontSize: 13, fontWeight: 700 }}>N</span>,
            })}
            {row('Miro', () => window.open('https://miro.com/app/board/uXjVHNOkJ6I=/?share_link_id=189842556230', '_blank', 'noopener,noreferrer'), {
              icon: <span style={{ fontSize: 13, fontWeight: 700 }}>M</span>,
            })}
            {row('OneNote', () => { window.location.href = ONE_NOTE_APP_URL; }, {
              icon: <span className="lm-onenote-glyph" aria-hidden="true">N</span>,
            })}
            {onIdoceo && row('iDoceo', onIdoceo, {
              className: 'lm-mobile-more-idoceo',
              icon: <img src="/assets/idoceo-icon.png" className="lm-idoceo-glyph" alt="" aria-hidden="true" />,
            })}
            {onUntis && row('WebUntis', onUntis, {
              icon: <span className="lm-webuntis-glyph" aria-hidden="true">W</span>,
            })}
            {divider}
          </>
        )}

        {/* Theme — Einstellungen, keine Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
          <button
            onClick={toggleTheme}
            aria-label={isDark ? t('app.theme_light') : t('app.theme_dark')}
            style={{
              flex: 1, height: 38, border: '1px solid var(--c-border)', borderRadius: 9,
              background: 'transparent', color: 'var(--c-text)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {isDark ? '☀️' : '🌙'} {isDark ? t('app.theme_light') : t('app.theme_dark')}
          </button>
        </div>

        {divider}

        {!(showWorkspaceTools && onRandomizer && onReflection) && row(t('app.logout'), onLogout, {
          danger: true,
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 8h8M11 5l3 3-3 3M6 2.5H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ),
        })}
      </div>
    </div>,
    document.body
  );
}
