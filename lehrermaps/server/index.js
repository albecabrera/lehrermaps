import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initSchema } from './db.js';
import authRouter from './routes/auth.js';
import foldersRouter from './routes/folders.js';
import filesRouter from './routes/files.js';
import linksRouter from './routes/links.js';
import scheduleRouter from './routes/schedule.js';

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.JWT_SECRET) {
  console.warn('\x1b[33m⚠  WARNING: JWT_SECRET not set — using insecure default. Set it in server/.env\x1b[0m');
}
if (!process.env.APP_PASSWORD) {
  console.warn('\x1b[33m⚠  WARNING: APP_PASSWORD not set — using default password "lehrer123"\x1b[0m');
}
if (!process.env.STUDENT_PASSWORD) {
  console.warn('\x1b[33m⚠  WARNING: STUDENT_PASSWORD not set — using default "schueler123"\x1b[0m');
}

const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:5173').split(',');
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

app.get('/api/health', (_, res) => res.json({ ok: true }));

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LehrerMaps server running on http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error('DB init failed:', e.message);
    console.error('Start server without DB (login will fail).');
    app.listen(PORT, () => {
      console.log(`LehrerMaps server running on http://localhost:${PORT} (no DB)`);
    });
  });
