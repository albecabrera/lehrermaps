import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
import { execFile } from 'child_process';
import { Server as SocketIOServer } from 'socket.io';
import pty from 'node-pty';
import { initSchema } from './db.js';
import authRouter from './routes/auth.js';
import foldersRouter from './routes/folders.js';
import filesRouter from './routes/files.js';
import linksRouter from './routes/links.js';
import scheduleRouter from './routes/schedule.js';
import aiRouter from './routes/ai.js';

const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

if (!process.env.JWT_SECRET) {
  console.warn('\x1b[33m⚠  WARNING: JWT_SECRET not set — using insecure default. Set it in server/.env\x1b[0m');
}
if (!process.env.APP_PASSWORD) {
  console.warn('\x1b[33m⚠  WARNING: APP_PASSWORD not set — using default password "lehrer123"\x1b[0m');
}
if (!process.env.STUDENT_PASSWORD) {
  console.warn('\x1b[33m⚠  WARNING: STUDENT_PASSWORD not set — using default "schueler123"\x1b[0m');
}

const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api', authRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/files', filesRouter);
app.use('/api/links', linksRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/ai', aiRouter);

app.get('/api/health', (_, res) => res.json({ ok: true }));

function requireLehrer(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    if (payload?.role !== 'lehrer') return res.status(403).json({ error: 'Forbidden' });
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();

app.post('/api/shell/open', requireLehrer, (req, res) => {
  // Try iTerm2, fall back to Terminal.app
  execFile('open', ['-a', 'iTerm', PROJECT_DIR], (err) => {
    if (err) {
      execFile('open', ['-a', 'Terminal', PROJECT_DIR], (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ ok: true, app: 'Terminal' });
      });
    } else {
      res.json({ ok: true, app: 'iTerm' });
    }
  });
});

// ── WebSocket terminal ──────────────────────────────────────────────────────
const io = new SocketIOServer(server, {
  path: '/ws',
  cors: {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Missing token'));
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    if (payload?.role !== 'lehrer') return next(new Error('Forbidden'));
    socket.user = payload;
    return next();
  } catch {
    return next(new Error('Unauthorized'));
  }
});

const SHELLS = [
  process.env.TERMINAL_SHELL,
  '/opt/homebrew/bin/fish',
  '/usr/local/bin/fish',
  process.env.SHELL,
  '/bin/zsh',
  '/bin/bash',
].filter(Boolean);

io.on('connection', (socket) => {
  let term = null;
  for (const sh of SHELLS) {
    try {
      term = pty.spawn(sh, ['-l'], {
        name: 'xterm-256color',
        cols: 120, rows: 32,
        cwd: PROJECT_DIR,
        env: { ...process.env, TERM: 'xterm-256color' },
      });
      break;
    } catch {}
  }
  if (!term) { socket.emit('terminal:error', 'No shell found'); socket.disconnect(); return; }

  socket.emit('terminal:ready', { shell: term.process });
  term.onData((data) => socket.emit('terminal:data', data));
  term.onExit(({ exitCode }) => socket.emit('terminal:exit', { exitCode }));

  socket.on('terminal:input', (data) => { try { term.write(data); } catch {} });
  socket.on('terminal:resize', ({ cols, rows }) => {
    if (cols > 0 && rows > 0) try { term.resize(cols, rows); } catch {}
  });
  socket.on('disconnect', () => { try { term.kill(); } catch {} });
});
// ────────────────────────────────────────────────────────────────────────────

initSchema()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`LehrerMaps server running on http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error('DB init failed:', e.message);
    console.error('Start server without DB (login will fail).');
    server.listen(PORT, () => {
      console.log(`LehrerMaps server running on http://localhost:${PORT} (no DB)`);
    });
  });
