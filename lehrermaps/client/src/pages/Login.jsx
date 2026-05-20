import { useState } from 'react';
import { login } from '../lib/api';
import { useLang } from '../contexts/LangContext';

export default function Login({ onLogin }) {
  const { t } = useLang();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const token = await login(password);
      localStorage.setItem('lm_token', token);
      onLogin();
    } catch {
      setError(t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--c-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"DM Sans", -apple-system, sans-serif',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'var(--c-surface)', borderRadius: 16,
        border: '1px solid var(--c-border-soft)',
        boxShadow: 'var(--c-shadow-modal)',
        padding: '40px 32px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #E8472A, #9333EA)',
            margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(232,71,42,0.3)',
          }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M3 6a2 2 0 0 1 2-2h5l2 2h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
                fill="rgba(255,255,255,0.9)"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--c-text)' }}>
            LehrerMaps
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-text-2)', marginTop: 4 }}>
            {t('login.subtitle')}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
              textTransform: 'uppercase', color: 'var(--c-text-3)',
            }}>{t('login.password')}</span>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.placeholder')}
              style={{
                appearance: 'none', border: `1px solid ${error ? '#DC2626' : 'var(--c-border)'}`,
                borderRadius: 8, background: 'var(--c-input-bg)', color: 'var(--c-text)',
                padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                transition: 'border-color .15s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#E8472A'}
              onBlur={(e) => e.target.style.borderColor = error ? '#DC2626' : 'var(--c-border)'}
            />
          </label>

          {error && (
            <div style={{
              fontSize: 12, color: 'var(--c-danger-text)', background: 'var(--c-danger-bg)',
              border: '1px solid var(--c-danger-border)', borderRadius: 7, padding: '8px 12px',
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              height: 42, border: 'none', borderRadius: 8,
              background: '#E8472A', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit', marginTop: 4,
              opacity: loading || !password ? 0.7 : 1,
              boxShadow: '0 2px 8px rgba(232,71,42,0.3)',
              transition: 'transform .1s, opacity .15s',
            }}
            onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={(e) => e.currentTarget.style.transform = ''}
          >
            {loading ? t('login.loading') : t('login.button')}
          </button>
        </form>

        <div style={{ fontSize: 11, color: 'var(--c-text-3)', textAlign: 'center', marginTop: 20 }}>
          {t('login.footer')}
        </div>
      </div>
    </div>
  );
}
