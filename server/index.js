import dotenv from 'dotenv';
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
import planArchivesRouter from './routes/planArchives.js';
import lessonSessionsRouter, { displaySession, displayPage } from './routes/lessonSessions.js';
import documentAnnotationsRouter from './routes/documentAnnotations.js';
import todayDashboardRouter from './routes/todayDashboard.js';
import bugChecklistRouter from './routes/bugChecklist.js';

// Load the production configuration next to this module.  The service may be
// started from the project root by a process manager, so relying on cwd would
// silently omit server/.env and reject requests from the public origin.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
const production = process.env.NODE_ENV === 'production';
const bindHost = process.env.BIND_HOST || (production ? '127.0.0.1' : '0.0.0.0');
const terminalEnabled = !production && process.env.ENABLE_TERMINAL === 'true';

if (production) {
  const missing = ['JWT_SECRET', 'APP_PASSWORD'].filter((key) => !process.env[key] || process.env[key].length < (key === 'JWT_SECRET' ? 32 : 1));
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
} else if (!process.env.JWT_SECRET || !process.env.APP_PASSWORD) {
  console.warn('Using development authentication defaults. Set JWT_SECRET and APP_PASSWORD before deployment.');
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

// Baseline security headers without adding a runtime dependency. CSP is left
// to the reverse proxy because deployments may provide different font/AI URLs.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.get('/api/health', async (_, res) => {
  try { await (await import('./db.js')).default.query('SELECT 1'); res.json({ ok: true, database: 'ok' }); }
  catch { res.status(503).json({ ok: false, database: 'unavailable' }); }
});

app.use('/api', corsMiddleware);
// Projection screens are intentionally public: their random, expiring token is
// the access capability. This must precede every router that installs auth
// middleware on the /api mount.
app.get('/api/display/:token', displaySession);
// A broad private router is mounted at /api below. Reserve the removed student
// login path as a genuine missing resource instead of letting that middleware
// turn it into an authentication response.
app.all('/api/login-student', (_req, res) => res.status(404).json({ error: 'API route not found' }));
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
app.use('/api/plan-archives', planArchivesRouter);
app.use('/api', documentAnnotationsRouter);
app.use('/api', todayDashboardRouter);
app.use('/api', bugChecklistRouter);
app.use('/api', lessonSessionsRouter);
app.get('/display/:token', displayPage);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

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

app.use((err, req, res, _next) => {
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  if (res.headersSent) return;
  res.status(err.statusCode || 500).json({
    error: production ? 'Internal server error' : (err.message || 'Internal server error'),
  });
});

initSchema()
  .then(() => {
    server.listen(PORT, bindHost, () => {
      console.log(`LehrerMaps server running on http://${bindHost}:${PORT}`);
    });
  })
  .catch((e) => {
    console.error('DB init failed:', e.message);
    process.exitCode = 1;
  });
