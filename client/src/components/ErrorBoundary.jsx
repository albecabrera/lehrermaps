import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ componentStack: info.componentStack });
    console.error('[ErrorBoundary]', error.message);
    console.error(info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: '#0f172a', color: '#f1f5f9',
        fontFamily: '"DM Mono", monospace', padding: 32, overflow: 'auto',
      }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="#EF4444" strokeWidth="2"/>
          <path d="M20 12v10M20 26v2" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f87171', fontFamily: '"DM Sans", sans-serif' }}>
          React Error — Component Stack
        </div>
        <pre style={{
          fontSize: 11, color: '#94a3b8', width: '100%', maxWidth: 720,
          background: '#1e293b', border: '1px solid #334155',
          borderRadius: 8, padding: '10px 14px', overflow: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left',
        }}>
          <span style={{ color: '#f87171', fontWeight: 700 }}>{this.state.error.message}</span>
          {'\n\n'}
          {this.state.componentStack || '(no stack)'}
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
