import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
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

io.on('connection', (socket) => {
  const preferredShell = process.env.TERMINAL_SHELL || '/opt/homebrew/bin/fish';
  const fallbackShell = process.env.SHELL || '/bin/zsh';
  const shell = preferredShell;

  let term;
  try {
    term = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 32,
      cwd: process.cwd(),
      env: process.env,
    });
  } catch {
    term = pty.spawn(fallbackShell, ['-l'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 32,
      cwd: process.cwd(),
      env: process.env,
    });
  }

  socket.emit('terminal:info', { shell: term.process });
  term.onData((data) => socket.emit('terminal:data', data));
  term.onExit(() => socket.emit('terminal:exit'));

  socket.on('terminal:input', (data) => {
    term.write(data);
  });

  socket.on('terminal:resize', ({ cols, rows }) => {
    if (cols > 0 && rows > 0) term.resize(cols, rows);
  });

  socket.on('disconnect', () => {
    try { term.kill(); } catch {}
  });
});

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
