import { useState, useRef, useEffect } from 'react';
import { login, loginStudent } from '../lib/api';
import { useLang } from '../contexts/LangContext';
import { useTheme } from '../contexts/ThemeContext';

export default function LoginPanel({ onLogin, initialRole = null }) {
  const { t, lang, setLang } = useLang();
  const { isDark, toggle: toggleTheme } = useTheme();

  const [step, setStep] = useState(initialRole || 'select');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState(() => localStorage.getItem('lm_teacher_avatar') || null);
  const [hoverAvatar, setHoverAvatar] = useState(false);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (step !== 'select') {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
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
      padding: 24,
    }}>
      {/* Top-right controls */}
      <div style={{
        position: 'fixed', top: 16, right: 16,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <button
          onClick={() => setLang(lang === 'de' ? 'es' : 'de')}
          style={topBtnStyle}
        >{lang === 'de' ? 'ES' : 'DE'}</button>
        <button onClick={toggleTheme} style={topBtnStyle}>
          {isDark ? (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M11.5 8.5A5 5 0 0 1 4.5 1.5a5 5 0 1 0 7 7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          )}
        </button>
      </div>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: step === 'select' ? 40 : 32 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'linear-gradient(135deg, #E8472A, #9333EA)',
          margin: '0 auto 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(232,71,42,0.25)',
        }}>
          <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
            <path d="M3 6a2 2 0 0 1 2-2h5l2 2h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
              fill="rgba(255,255,255,0.9)"/>
          </svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: 'var(--c-text)' }}>
          LehrerMaps
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 3 }}>
          {step === 'select' ? t('login.choose_role') : t('login.subtitle')}
        </div>
      </div>

      {step === 'select' ? (
        /* ── Role selector ── */
        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center',
          maxWidth: 480,
        }}>
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
      ) : (
        /* ── Password form ── */
        <div style={{
          width: '100%', maxWidth: 340,
          background: 'var(--c-surface)', borderRadius: 20,
          border: '1px solid var(--c-border-soft)',
          boxShadow: 'var(--c-shadow-modal)',
          padding: '32px 28px',
          animation: 'lmSlideUp .2s cubic-bezier(.4,.7,.3,1)',
        }}>
          {/* Back */}
          <button
            onClick={back}
            style={{
              appearance: 'none', border: 'none', background: 'transparent',
              color: 'var(--c-text-3)', cursor: 'pointer', padding: '0 0 18px',
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-text-3)'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('login.back')}
          </button>

          {/* Role avatar */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              {isTeacher ? (
                <TeacherAvatar
                  avatar={avatar}
                  onChange={handleAvatarChange}
                  fileRef={fileRef}
                  hovered={hoverAvatar}
                  setHovered={setHoverAvatar}
                  size={80}
                  changeLabel={t('login.change_photo')}
                />
              ) : (
                <StudentAvatar size={80} />
              )}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)', letterSpacing: -0.3 }}>
              {isTeacher ? t('login.teacher_role') : t('login.student_role')}
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
                  transition: 'border-color .15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}22`; }}
                onBlur={(e) => { e.target.style.borderColor = error ? '#DC2626' : 'var(--c-border)'; e.target.style.boxShadow = 'none'; }}
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
                boxShadow: `0 3px 12px ${accent}33`,
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

      <div style={{ fontSize: 10, color: 'var(--c-text-3)', marginTop: 32 }}>
        {t('login.footer')}
      </div>
    </div>
  );
}

function RoleCard({ label, desc, accent, onClick, avatar }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        appearance: 'none', font: 'inherit', cursor: 'pointer',
        width: 200, padding: '28px 20px 24px',
        background: hovered ? 'var(--c-surface)' : 'var(--c-surface)',
        border: `1.5px solid ${hovered ? accent : 'var(--c-border)'}`,
        borderRadius: 20,
        boxShadow: hovered
          ? `0 8px 32px ${accent}22, 0 2px 8px rgba(0,0,0,0.08)`
          : '0 1px 4px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        transition: 'border-color .15s, box-shadow .15s, transform .1s',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      {avatar}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text-3)', lineHeight: 1.4 }}>
          {desc}
        </div>
      </div>
      <div style={{
        height: 28, padding: '0 16px', borderRadius: 8,
        background: `${accent}14`, color: accent,
        fontSize: 11, fontWeight: 600,
        display: 'flex', alignItems: 'center',
        border: `1px solid ${accent}33`,
        transition: 'background .1s',
      }}>
        →
      </div>
    </button>
  );
}

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
          background: avatar ? 'transparent' : 'linear-gradient(135deg, #E8472A, #9333EA)',
          overflow: 'hidden', cursor: 'pointer', position: 'relative',
          border: '2.5px solid var(--c-border)',
          boxShadow: hovered ? '0 0 0 3px #E8472A33' : 'none',
          transition: 'box-shadow .15s',
          flexShrink: 0,
        }}
      >
        {avatar ? (
          <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="9" r="4.5" fill="rgba(255,255,255,0.9)"/>
              <path d="M4 23c0-4.97 4.03-9 9-9s9 4.03 9 9" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        )}
        {/* Camera overlay on hover */}
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 2,
          }}>
            <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
              <path d="M6.5 1h5l1.5 2H16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2.5L6.5 1Z" stroke="white" strokeWidth="1.3" strokeLinejoin="round"/>
              <circle cx="9" cy="8.5" r="2.5" stroke="white" strokeWidth="1.3"/>
            </svg>
            <span style={{ fontSize: 8, color: '#fff', fontWeight: 600, letterSpacing: 0.3, lineHeight: 1 }}>
              {changeLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentAvatar({ size = 72 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '2.5px solid var(--c-border)',
      flexShrink: 0,
    }}>
      <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 26 26" fill="none">
        <circle cx="13" cy="9" r="4.5" fill="rgba(255,255,255,0.9)"/>
        <path d="M4 23c0-4.97 4.03-9 9-9s9 4.03 9 9" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round"/>
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
