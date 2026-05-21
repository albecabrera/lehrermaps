import { useState, useRef, useEffect } from 'react';
import { login, loginStudent } from '../lib/api';
import { useLang } from '../contexts/LangContext';
import { useTheme } from '../contexts/ThemeContext';

const DEFAULT_AVATAR = '/teacher-avatar.jpg';

export default function LoginPanel({ onLogin, initialRole = null }) {
  const { t, lang, setLang } = useLang();
  const { isDark, toggle: toggleTheme } = useTheme();

  const [step, setStep] = useState(initialRole || 'select');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState(
    () => localStorage.getItem('lm_teacher_avatar') || DEFAULT_AVATAR
  );
  const [hoverAvatar, setHoverAvatar] = useState(false);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (step !== 'select') setTimeout(() => inputRef.current?.focus(), 80);
  }, [step]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      localStorage.setItem('lm_teacher_avatar', b64);
      setAvatar(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError('');
    try {
      const token = step === 'teacher'
        ? await login(password)
        : await loginStudent(password);
      localStorage.setItem('lm_token', token);
      onLogin();
    } catch {
      setError(step === 'teacher' ? t('login.error') : t('student.error'));
    } finally {
      setLoading(false);
    }
  };

  const back = () => { setStep('select'); setPassword(''); setError(''); };

  const isTeacher = step === 'teacher';
  const accent = isTeacher ? '#E8472A' : '#0EA5E9';

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--c-bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '"DM Sans", -apple-system, sans-serif',
      padding: '24px 24px 40px',
      position: 'relative',
    }}>

      {/* Top-right controls */}
      <div style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8 }}>
        <button onClick={() => setLang(lang === 'de' ? 'es' : 'de')} style={topBtnStyle}>
          {lang === 'de' ? 'ES' : 'DE'}
        </button>
        <button onClick={toggleTheme} style={topBtnStyle}>
          {isDark
            ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            : <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M11.5 8.5A5 5 0 0 1 4.5 1.5a5 5 0 1 0 7 7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          }
        </button>
      </div>

      {step === 'select' ? (
        <>
          {/* ── Banner ── */}
          <WelcomeBanner />

          {/* ── Role cards ── */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <RoleCard
              label={t('login.teacher_role')}
              desc={t('login.teacher_desc')}
              accent="#E8472A"
              onClick={() => setStep('teacher')}
              avatar={
                <TeacherAvatar
                  avatar={avatar}
                  onChange={handleAvatarChange}
                  fileRef={fileRef}
                  hovered={hoverAvatar}
                  setHovered={setHoverAvatar}
                  changeLabel={t('login.change_photo')}
                />
              }
            />
            <RoleCard
              label={t('login.student_role')}
              desc={t('login.student_desc')}
              accent="#0EA5E9"
              onClick={() => setStep('student')}
              avatar={<StudentAvatar />}
            />
          </div>

          <div style={{ fontSize: 10, color: 'var(--c-text-3)', marginTop: 36 }}>
            {t('login.footer')}
          </div>
        </>
      ) : (
        /* ── Password form ── */
        <div className="lm-modal-surface" style={{
          width: '100%', maxWidth: 340,
          background: 'var(--c-surface)', borderRadius: 20,
          border: '1px solid var(--c-border-soft)',
          boxShadow: 'var(--c-shadow-modal)',
          padding: '28px 28px 32px',
          animation: 'lmSlideUp .2s cubic-bezier(.4,.7,.3,1)',
        }}>
          <button
            onClick={back}
            style={{
              appearance: 'none', border: 'none', background: 'transparent',
              color: 'var(--c-text-3)', cursor: 'pointer', padding: '0 0 20px',
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-text-3)'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('login.back')}
          </button>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              {isTeacher ? (
                <TeacherAvatar
                  avatar={avatar}
                  onChange={handleAvatarChange}
                  fileRef={fileRef}
                  hovered={hoverAvatar}
                  setHovered={setHoverAvatar}
                  size={84}
                  changeLabel={t('login.change_photo')}
                />
              ) : (
                <StudentAvatar size={84} />
              )}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text)', letterSpacing: -0.3 }}>
              {isTeacher ? t('login.teacher_role') : t('login.student_role')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 2 }}>
              {isTeacher ? t('login.teacher_desc') : t('login.student_desc')}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
                textTransform: 'uppercase', color: 'var(--c-text-3)',
              }}>
                {isTeacher ? t('login.password') : t('student.password')}
              </span>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isTeacher ? t('login.placeholder') : t('student.placeholder')}
                style={{
                  appearance: 'none',
                  border: `1px solid ${error ? '#DC2626' : 'var(--c-border)'}`,
                  borderRadius: 10, background: 'var(--c-input-bg)', color: 'var(--c-text)',
                  padding: '11px 13px', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                  transition: 'border-color .15s, box-shadow .15s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = accent;
                  e.target.style.boxShadow = `0 0 0 3px ${accent}22`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error ? '#DC2626' : 'var(--c-border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </label>

            {error && (
              <div style={{
                fontSize: 12, color: 'var(--c-danger-text)', background: 'var(--c-danger-bg)',
                border: '1px solid var(--c-danger-border)', borderRadius: 8, padding: '8px 12px',
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                height: 44, border: 'none', borderRadius: 10,
                background: accent, color: '#fff',
                fontSize: 14, fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit', marginTop: 4,
                opacity: loading || !password ? 0.65 : 1,
                boxShadow: `0 3px 14px ${accent}40`,
                transition: 'transform .1s, opacity .15s',
              }}
              onMouseDown={(e) => { if (!loading && password) e.currentTarget.style.transform = 'scale(0.98)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = ''; }}
            >
              {loading
                ? (isTeacher ? t('login.loading') : t('student.loading'))
                : (isTeacher ? t('login.button') : t('student.button'))}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ── Welcome Banner ─────────────────────────────────────── */
function WelcomeBanner() {
  return (
    <div style={{
      width: '100%', maxWidth: 480, marginBottom: 36,
      borderRadius: 24, overflow: 'hidden',
      boxShadow: '0 12px 48px rgba(10,14,40,0.35), 0 2px 8px rgba(0,0,0,0.12)',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #0a0f1e 0%, #131929 30%, #1c1040 58%, #3b1f6a 80%, #6b2d4a 100%)',
        padding: '34px 36px 30px',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Decorative orbs */}
        <div style={{
          position: 'absolute', top: -50, right: -50,
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(107,45,74,0.55) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -30,
          width: 160, height: 160, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,31,106,0.6) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Subtle grid lines */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        }} />

        {/* School badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 20, padding: '5px 13px',
          marginBottom: 22, backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: 5,
            background: 'linear-gradient(135deg, #E8472A, #9333EA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="10" height="10" viewBox="0 0 26 26" fill="none">
              <path d="M3 6a2 2 0 0 1 2-2h5l2 2h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
                fill="rgba(255,255,255,0.95)"/>
            </svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.2 }}>
            LehrerMaps
          </span>
        </div>

        {/* School name */}
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
          textTransform: 'uppercase', marginBottom: 10,
          color: 'transparent',
          background: 'linear-gradient(90deg, #c084fc, #f0abfc)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
        }}>
          Elisabeth-Selbert-Gesamtschule · Bonn
        </div>

        {/* Main heading */}
        <h1 style={{
          fontSize: 34, fontWeight: 800, margin: '0 0 10px',
          letterSpacing: -1.2, lineHeight: 1.12,
          background: 'linear-gradient(100deg, #ffffff 0%, #e9d5ff 45%, #fca5a5 85%, #fdba74 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Herzlich<br />Willkommen
        </h1>

        <p style={{
          margin: 0, fontSize: 12.5,
          color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.55, maxWidth: 270,
        }}>
          Unterrichtsmaterialien verwalten — sicher, schnell und übersichtlich.
        </p>

        {/* Stats strip */}
        <div style={{
          marginTop: 22, paddingTop: 18,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', gap: 0,
        }}>
          {[
            ['4', 'Fächer'],
            ['∞', 'Dateien'],
            ['✓', 'DSGVO-konform'],
          ].map(([val, label], i) => (
            <div key={label} style={{
              flex: 1, paddingRight: 12,
              borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              marginRight: i < 2 ? 12 : 0,
            }}>
              <div style={{
                fontSize: 16, fontWeight: 800, lineHeight: 1,
                background: 'linear-gradient(135deg, #e9d5ff, #fca5a5)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>{val}</div>
              <div style={{
                fontSize: 9, color: 'rgba(255,255,255,0.38)',
                letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 3,
              }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Role card ───────────────────────────────────────────── */
function RoleCard({ label, desc, accent, onClick, avatar }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        appearance: 'none', font: 'inherit', cursor: 'pointer',
        width: 200, padding: '28px 20px 22px',
        background: 'var(--c-surface)',
        border: `1.5px solid ${hovered ? accent : 'var(--c-border)'}`,
        borderRadius: 20,
        boxShadow: hovered
          ? `0 10px 40px ${accent}28, 0 2px 10px rgba(0,0,0,0.1)`
          : '0 1px 6px rgba(0,0,0,0.07)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        transition: 'border-color .15s, box-shadow .18s, transform .12s',
        transform: hovered ? 'translateY(-3px)' : 'none',
      }}
    >
      {avatar}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text-3)', lineHeight: 1.4 }}>
          {desc}
        </div>
      </div>
      <div style={{
        height: 28, padding: '0 18px', borderRadius: 8,
        background: hovered ? accent : `${accent}14`,
        color: hovered ? '#fff' : accent,
        fontSize: 11, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 5,
        border: `1px solid ${accent}33`,
        transition: 'background .15s, color .15s',
      }}>
        Einloggen
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5h6M6 3l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );
}

/* ── Teacher avatar (uploadable) ─────────────────────────── */
function TeacherAvatar({ avatar, onChange, fileRef, hovered, setHovered, size = 72, changeLabel }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onChange}
      />
      <div
        onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: size, height: size, borderRadius: '50%',
          overflow: 'hidden', cursor: 'pointer', position: 'relative',
          border: '3px solid var(--c-border)',
          boxShadow: hovered
            ? '0 0 0 3px #E8472A44, 0 4px 20px rgba(0,0,0,0.15)'
            : '0 2px 12px rgba(0,0,0,0.12)',
          transition: 'box-shadow .15s',
          flexShrink: 0,
        }}
      >
        <img src={avatar} alt="Lehrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

        {/* Camera overlay */}
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
          }}>
            <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
              <path d="M6.5 1h5l1.5 2H16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2.5L6.5 1Z"
                stroke="white" strokeWidth="1.3" strokeLinejoin="round"/>
              <circle cx="9" cy="8.5" r="2.5" stroke="white" strokeWidth="1.3"/>
            </svg>
            <span style={{ fontSize: 8, color: '#fff', fontWeight: 600, letterSpacing: 0.3 }}>
              {changeLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Student avatar ──────────────────────────────────────── */
function StudentAvatar({ size = 72 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '3px solid var(--c-border)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
      flexShrink: 0,
    }}>
      <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 26 26" fill="none">
        <circle cx="13" cy="9" r="4.5" fill="rgba(255,255,255,0.9)"/>
        <path d="M4 23c0-4.97 4.03-9 9-9s9 4.03 9 9"
          stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

const topBtnStyle = {
  width: 32, height: 32,
  border: '1px solid var(--c-border)', borderRadius: 8,
  background: 'var(--c-surface)', cursor: 'pointer',
  color: 'var(--c-text-2)', fontSize: 11, fontWeight: 600,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: '"DM Sans", -apple-system, sans-serif',
};
