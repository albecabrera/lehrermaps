import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

export default function TerminalModal({ open, onClose }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const socketRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'ready' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!open) return;

    const token = localStorage.getItem('lm_token');

    // xterm setup
    const term = new Terminal({
      fontFamily: '"DM Mono", "Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      theme: {
        background: '#0D1117',
        foreground: '#ECF0FA',
        cursor: '#7C8DB5',
        selectionBackground: 'rgba(124,141,181,0.3)',
        black: '#1C2338', red: '#FF6B6B', green: '#6BCB77', yellow: '#FFD93D',
        blue: '#4D96FF', magenta: '#C77DFF', cyan: '#48CAE4', white: '#ECF0FA',
        brightBlack: '#636F8A', brightRed: '#FF8E8E', brightGreen: '#8EE5A0',
        brightYellow: '#FFE66D', brightBlue: '#7DB8FF', brightMagenta: '#D9A7FF',
        brightCyan: '#7AD7ED', brightWhite: '#FFFFFF',
      },
      cursorBlink: true,
      allowTransparency: true,
      scrollback: 3000,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitAddonRef.current = fit;

    if (containerRef.current) {
      term.open(containerRef.current);
      requestAnimationFrame(() => { try { fit.fit(); } catch {} });
    }

    // Socket.io via Vite proxy (/ws → localhost:3001)
    const socket = io({
      path: '/ws',
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    socketRef.current = socket;

    socket.on('connect', () => setStatus('connecting'));
    socket.on('terminal:ready', ({ shell }) => {
      setStatus('ready');
      term.writeln(`\x1b[32m✓ Connected — ${shell}\x1b[0m\r\n`);
      try { fit.fit(); } catch {}
    });
    socket.on('terminal:data', (data) => term.write(data));
    socket.on('terminal:exit', ({ exitCode }) => {
      term.writeln(`\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m`);
    });
    socket.on('terminal:error', (msg) => {
      setStatus('error');
      setErrorMsg(msg || 'Shell error');
    });
    socket.on('connect_error', (err) => {
      setStatus('error');
      setErrorMsg(err.message || 'Connection failed');
    });
    socket.on('disconnect', () => {
      if (status !== 'error') term.writeln('\r\n\x1b[33m[Disconnected]\x1b[0m');
    });

    term.onData((data) => socket.emit('terminal:input', data));

    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
        socket.emit('terminal:resize', { cols: term.cols, rows: term.rows });
      } catch {}
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      socket.disconnect();
      term.dispose();
      termRef.current = null;
      socketRef.current = null;
      fitAddonRef.current = null;
      setStatus('connecting');
      setErrorMsg('');
    };
  }, [open]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: 'min(900px, 95vw)', height: 'min(560px, 90vh)',
        display: 'flex', flexDirection: 'column',
        background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Title bar */}
        <div style={{
          padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.03)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57', cursor: 'pointer' }} onClick={onClose} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
          </div>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
            {status === 'ready' ? 'Terminal' : status === 'error' ? `Error: ${errorMsg}` : 'Verbinden…'}
          </span>
          <button onClick={onClose} style={{
            width: 20, height: 20, border: 'none', background: 'transparent',
            cursor: 'pointer', color: 'rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Terminal area */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {status === 'error' && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10,
              color: '#FF6B6B', fontSize: 13, fontFamily: 'monospace',
            }}>
              <span style={{ fontSize: 28 }}>✕</span>
              <span>{errorMsg || 'Connection failed'}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                Check that the server is running on port 3001
              </span>
            </div>
          )}
          <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', padding: '4px 6px', boxSizing: 'border-box' }}
          />
        </div>
      </div>
    </div>
  );
}
