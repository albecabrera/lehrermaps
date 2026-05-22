import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  const expected = process.env.APP_PASSWORD || 'lehrer123';
  const legacy = process.env.APP_PASSWORD_LEGACY || 'lehrer';
  const secret   = process.env.JWT_SECRET   || 'dev_secret';

  const ok = password && (password === expected || password === legacy);
  if (!ok) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }

  const token = jwt.sign({ role: 'lehrer' }, secret, { expiresIn: '30d' });
  res.json({ token });
});

router.post('/login-student', (req, res) => {
  const { password } = req.body;
  const expected = process.env.STUDENT_PASSWORD || 'schueler123';
  const secret   = process.env.JWT_SECRET || 'dev_secret';

  if (!password || password !== expected) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }

  const token = jwt.sign({ role: 'student' }, secret, { expiresIn: '12h' });
  res.json({ token });
});

export default router;
