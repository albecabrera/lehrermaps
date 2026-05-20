// OS-Fensterhüllen — macOS, Windows 11, GNOME/Linux
// Schlank gehalten; alle nehmen ihre Inhalte als children.

function MacChrome({ title = 'LehrerMaps', accent = '#E8472A', children }) {
  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden', height: '100%',
      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column', background: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "DM Sans", sans-serif',
    }}>
      <div style={{
        height: 38, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 14px',
        background: 'linear-gradient(180deg, #f6f6f6, #ececec)',
        borderBottom: '0.5px solid rgba(0,0,0,0.12)',
        position: 'relative', flexShrink: 0,
      }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.12)' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.12)' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.12)' }} />
        <span style={{
          position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none',
          fontSize: 12, fontWeight: 500, color: '#4b4b4b', letterSpacing: 0.1,
        }}>{title}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</div>
    </div>
  );
}

function WinChrome({ title = 'LehrerMaps', accent = '#2563EB', children }) {
  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden', height: '100%',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column', background: '#fff',
      fontFamily: '"Segoe UI Variable", "Segoe UI", "DM Sans", sans-serif',
    }}>
      <div style={{
        height: 34, display: 'flex', alignItems: 'center',
        background: '#f3f3f3',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', flex: 1 }}>
          <div style={{
            width: 14, height: 14, borderRadius: 3,
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.1)',
          }} />
          <span style={{ fontSize: 12, fontWeight: 400, color: '#222' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', height: '100%' }}>
          {['—', '▢', '×'].map((g, i) => (
            <div key={i} style={{
              width: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: i === 2 ? '#666' : '#555',
            }}>{g}</div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</div>
    </div>
  );
}

function LinuxChrome({ title = 'LehrerMaps', accent = '#16A34A', children }) {
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden', height: '100%',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.16)',
      display: 'flex', flexDirection: 'column', background: '#fff',
      fontFamily: '"Inter", "Cantarell", "DM Sans", sans-serif',
    }}>
      <div style={{
        height: 42, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 10px 0 16px',
        background: 'linear-gradient(180deg, #fafafa, #f0f0f0)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#222' }}>{title}</span>
        <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>— Ordnerstruktur</span>
        <div style={{ flex: 1 }} />
        <button style={chip()}><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8M6 2v8" stroke="#444" strokeWidth="1.4" strokeLinecap="round"/></svg></button>
        <button style={chip()}>☰</button>
        <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
          {[0,1,2].map(i => (
            <span key={i} style={{
              width: 24, height: 24, borderRadius: '50%', background: '#e6e6e6',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: '#666',
            }}>{['—','▢','×'][i]}</span>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</div>
    </div>
  );
}

function chip() {
  return {
    height: 24, padding: '0 8px', borderRadius: 6, border: 'none',
    background: '#e9e9e9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, color: '#444', cursor: 'pointer',
  };
}

Object.assign(window, { MacChrome, WinChrome, LinuxChrome });
