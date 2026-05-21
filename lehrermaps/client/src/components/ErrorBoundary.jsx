import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'var(--c-bg)', color: 'var(--c-text)',
        fontFamily: '"DM Sans", -apple-system, sans-serif', padding: 32,
      }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="#EF4444" strokeWidth="2"/>
          <path d="M20 12v10M20 26v2" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text)' }}>
          Etwas ist schiefgelaufen
        </div>
        <pre style={{
          fontSize: 11, color: 'var(--c-text-3)', maxWidth: 480,
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 8, padding: '10px 14px', overflow: 'auto',
          fontFamily: '"DM Mono", monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {this.state.error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{
            height: 36, padding: '0 20px', border: 'none', borderRadius: 8,
            background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Neu laden
        </button>
      </div>
    );
  }
}
