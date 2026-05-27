import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  const expected = process.env.APP_PASSWORD || 'lehrer';
  const secret = process.env.JWT_SECRET || 'dev_secret';
  if (password !== expected) return res.status(401).json({ error: 'Falsches Passwort' });
  const token = jwt.sign({ role: 'lehrer' }, secret, { expiresIn: '30d' });
  res.json({ token });
});

router.post('/login-student', (req, res) => {
  const { password } = req.body;
  const expected = process.env.STUDENT_PASSWORD || 'schueler';
  const secret   = process.env.JWT_SECRET || 'dev_secret';

  if (!password || password !== expected) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }

  const token = jwt.sign({ role: 'student' }, secret, { expiresIn: '12h' });
  res.json({ token });
});

export default router;
