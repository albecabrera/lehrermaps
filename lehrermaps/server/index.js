import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
import { execFile } from 'child_process';
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
