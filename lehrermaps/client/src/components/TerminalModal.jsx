import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

export default function TerminalModal({ open, onClose }) {
  const hostRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const socketRef = useRef(null);
  const [info, setInfo] = useState('');
  const [bootingClaude, setBootingClaude] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const token = localStorage.getItem('lm_token');
    if (!token) {
      setInfo('sin token');
      return undefined;
    }
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"DM Mono", Menlo, monospace',
      theme: { background: '#0B0F19', foreground: '#E5E7EB' },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(hostRef.current);
    fitAddon.fit();
    termRef.current = term;
    fitRef.current = fitAddon;

    const socketOrigin = import.meta.env.VITE_WS_ORIGIN || `${window.location.protocol}//${window.location.hostname}:3001`;
    const socket = io(socketOrigin, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('terminal:info', (payload) => setInfo(payload?.shell || 'shell'));
    socket.on('terminal:data', (d) => term.write(d));
    socket.on('terminal:exit', () => term.writeln('\r\n[terminal closed]'));
    socket.on('connect_error', (e) => {
      term.writeln(`\r\n[error] conexión: ${e?.message || 'desconocido'}`);
      const reason = e?.description?.message || e?.description || '';
      if (reason) term.writeln(`[detalle] ${String(reason)}`);
      term.writeln(`[hint] Verificá que el backend (puerto 3001) esté corriendo.`);
    });

    term.onData((data) => socket.emit('terminal:input', data));
    const onResize = () => {
      fitAddon.fit();
      socket.emit('terminal:resize', { cols: term.cols, rows: term.rows });
    };
    window.addEventListener('resize', onResize);
    onResize();

    return () => {
      window.removeEventListener('resize', onResize);
      try { socket.disconnect(); } catch {}
      try { term.dispose(); } catch {}
      socketRef.current = null;
      termRef.current = null;
      fitRef.current = null;
      setInfo('');
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={card}>
        <div style={head}>
          <strong style={{ fontSize: 13 }}>Terminal</strong>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{info}</div>
          <button
            onClick={() => {
              if (!socketRef.current) return;
              setBootingClaude(true);
              socketRef.current.emit('terminal:input', 'claude\n');
              setTimeout(() => setBootingClaude(false), 800);
            }}
            style={actionBtn}
          >
            {bootingClaude ? 'Abriendo…' : 'Abrir Claude'}
          </button>
          <button onClick={onClose} style={closeBtn}>Cerrar</button>
        </div>
        <div ref={hostRef} style={{ height: '68vh', width: '100%' }} />
      </div>
    </div>,
    document.body
  );
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 1900,
  background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const card = {
  width: 'min(1200px, 96vw)', borderRadius: 12, overflow: 'hidden',
  border: '1px solid #1F2937', background: '#0B0F19',
  boxShadow: '0 30px 80px rgba(0,0,0,.5)',
};
const head = {
  height: 40, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
  borderBottom: '1px solid #1F2937', color: '#E5E7EB', background: '#0F172A',
};
const closeBtn = {
  marginLeft: 'auto', border: '1px solid #334155', background: '#111827',
  color: '#E5E7EB', borderRadius: 6, height: 26, padding: '0 10px', cursor: 'pointer',
};
const actionBtn = {
  border: '1px solid #334155', background: '#111827',
  color: '#E5E7EB', borderRadius: 6, height: 26, padding: '0 10px', cursor: 'pointer',
  fontSize: 11,
};
