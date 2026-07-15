import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';

// Gemeinsame Icons für Bottom-Nav-Ziele (Lehrer- und Studenten-App)
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
            <span style={{ fontSize: 10, fontWeight: on ? 700 : 500, letterSpacing: 0.2 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// „Mehr"-Bottom-Sheet: alles, was auf Desktop in der Kopfleiste wohnt,
// aber mobil zu selten gebraucht wird, um Platz zu verdienen.
// Lehrer-Einträge (Termine/Upload/Arbeitsblatt/Notion/Miro) erscheinen nur,
// wenn die zugehörigen Handler übergeben werden — die Studenten-App
// nutzt dasselbe Sheet nur mit Theme/Sprache/Abmelden.
export function MobileMoreSheet({
  open, onClose, t, accent,
  isDark, toggleTheme, lang, setLang,
  onExams, onWorksheet, onUpload, uploadDisabled, onLogout,
  showTeacherLinks = false,
}) {
  useEscapeKey(open, onClose);
  if (!open) return null;

  const row = (label, onClick, { disabled = false, danger = false, icon = null } = {}) => (
    <button
      onClick={() => { if (disabled) return; onClick(); onClose(); }}
      disabled={disabled}
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
  const hasActions = onExams || onUpload || onWorksheet;

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

        {hasActions && divider}

        {showTeacherLinks && (
          <>
            {row('Notion', () => window.open('https://www.notion.so/acabreraes/Q1-Apuntes-36d29f35ce65804bb227ea3b08dbfc0e?source=copy_link', '_blank', 'noopener,noreferrer'), {
              icon: <span style={{ fontSize: 13, fontWeight: 700 }}>N</span>,
            })}
            {row('Miro', () => window.open('https://miro.com/app/board/uXjVHNOkJ6I=/?share_link_id=189842556230', '_blank', 'noopener,noreferrer'), {
              icon: <span style={{ fontSize: 13, fontWeight: 700 }}>M</span>,
            })}
            {divider}
          </>
        )}

        {/* Theme + Sprache in einer Zeile — Einstellungen, keine Navigation */}
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
          <div style={{
            display: 'flex', gap: 4, padding: 3,
            border: '1px solid var(--c-border)', borderRadius: 9,
          }}>
            {['de', 'en', 'es'].map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{
                  height: 30, minWidth: 36, border: 'none', borderRadius: 6,
                  background: lang === code ? `${accent}18` : 'transparent',
                  color: lang === code ? accent : 'var(--c-text-2)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {divider}

        {row(t('app.logout'), onLogout, {
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
