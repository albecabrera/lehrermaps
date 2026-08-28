import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
function loginLimit(req, res, next) {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const item = attempts.get(key);
  if (item && now - item.started < WINDOW_MS && item.count >= MAX_ATTEMPTS) {
    res.set('Retry-After', String(Math.ceil((WINDOW_MS - (now - item.started)) / 1000)));
    return res.status(429).json({ error: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.' });
  }
  req.loginAttemptKey = key;
  return next();
}
function failedLogin(req) {
  const now = Date.now(); const current = attempts.get(req.loginAttemptKey);
  attempts.set(req.loginAttemptKey, !current || now - current.started >= WINDOW_MS ? { started: now, count: 1 } : { ...current, count: current.count + 1 });
}
function successfulLogin(req) { attempts.delete(req.loginAttemptKey); }

router.post('/login', loginLimit, (req, res) => {
  const { password } = req.body;
  const expected = process.env.APP_PASSWORD || 'lehrer';
  const secret = process.env.JWT_SECRET || 'dev_secret';
  if (password !== expected) { failedLogin(req); return res.status(401).json({ error: 'Falsches Passwort' }); }
  const token = jwt.sign({ role: 'lehrer' }, secret, { expiresIn: '30d' });
  successfulLogin(req);
  res.json({ token });
});


export default router;
