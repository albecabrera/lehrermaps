import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { execFile } from 'child_process';
import { Server as SocketIOServer } from 'socket.io';
import pty from '@homebridge/node-pty-prebuilt-multiarch';
import { initSchema } from './db.js';
import authRouter from './routes/auth.js';
import foldersRouter from './routes/folders.js';
import filesRouter from './routes/files.js';
import linksRouter from './routes/links.js';
import scheduleRouter from './routes/schedule.js';
import aiRouter from './routes/ai.js';
import notebooksRouter from './routes/notebooks.js';
import searchRouter from './routes/search.js';
import examsRouter from './routes/exams.js';
import plansRouter from './routes/plans.js';
import lessonSessionsRouter, { displaySession, displayPage } from './routes/lessonSessions.js';
import documentAnnotationsRouter from './routes/documentAnnotations.js';

const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
const production = process.env.NODE_ENV === 'production';
const terminalEnabled = !production && process.env.ENABLE_TERMINAL === 'true';

if (production) {
  const missing = ['JWT_SECRET', 'APP_PASSWORD', 'STUDENT_PASSWORD'].filter((key) => !process.env[key] || process.env[key].length < (key === 'JWT_SECRET' ? 32 : 1));
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
} else if (!process.env.JWT_SECRET || !process.env.APP_PASSWORD || !process.env.STUDENT_PASSWORD) {
  console.warn('Using development authentication defaults. Set JWT_SECRET, APP_PASSWORD and STUDENT_PASSWORD before deployment.');
}

const _configuredOrigins = (
  process.env.ALLOWED_ORIGIN ||
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4176,http://127.0.0.1:4176,http://localhost:4177,http://127.0.0.1:4177'
).split(',').map((s) => s.trim()).filter(Boolean);
const allowedOrigins = [
  ..._configuredOrigins,
  'http://localhost:8090',
  'http://127.0.0.1:8090',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];

const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
});
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_, res) => {
  try { await (await import('./db.js')).default.query('SELECT 1'); res.json({ ok: true, database: 'ok' }); }
  catch { res.status(503).json({ ok: false, database: 'unavailable' }); }
});

app.use('/api', corsMiddleware);
app.use('/api', authRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/files', filesRouter);
app.use('/api/links', linksRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/ai', aiRouter);
app.use('/api', notebooksRouter);
app.use('/api/search', searchRouter);
app.use('/api/exams', examsRouter);
app.use('/api/plans', plansRouter);
app.use('/api', documentAnnotationsRouter);
app.get('/api/display/:token', displaySession);
app.use('/api', lessonSessionsRouter);
app.get('/display/:token', displayPage);

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

if (terminalEnabled) app.post('/api/shell/open', requireLehrer, (req, res) => {
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

// ── Cliente estático (build de producción) ─────────────────────────────────
// Sirve client/dist si existe, con fallback SPA — permite usar la app
// completa desde http://localhost:3001 sin levantar Vite.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  // Vite copies public icons to /icons; preserve the public PWA URL used by
  // the Apache deployment when this same build is served directly by Node.
  app.use('/assets/icons', express.static(path.join(CLIENT_DIST, 'icons')));
  app.use((req, res, next) => {
    if (['/', '/index.html', '/manifest.json', '/service-worker.js'].includes(req.path)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  });
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// ── WebSocket terminal ──────────────────────────────────────────────────────
const io = terminalEnabled ? new SocketIOServer(server, {
  path: '/ws',
  cors: {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
}) : null;

if (io) io.use((socket, next) => {
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
  '/bin/sh',
].filter(Boolean).filter((sh, index, shells) => shells.indexOf(sh) === index && fs.existsSync(sh));

if (io) io.on('connection', (socket) => {
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
    process.exitCode = 1;
  });
