import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import pool from '../db.js';
import auth, { teacherOnly } from '../middleware/auth.js';
import { normalizeShortLinkUrl } from '../lib/shortLinks.js';

const router = Router();
const CODE_LENGTH = 16;
const MAX_URL_LENGTH = 4096;

router.get('/s/:code', async (req, res) => {
  const { code } = req.params;
  if (!new RegExp(`^[A-Za-z0-9_-]{${CODE_LENGTH}}$`).test(code)) {
    return res.status(404).json({ error: 'Short link not found' });
  }

  try {
    const [rows] = await pool.execute('SELECT destination_url FROM short_links WHERE code = ?', [code]);
    if (!rows.length) return res.status(404).json({ error: 'Short link not found' });
    res.redirect(302, rows[0].destination_url);
  } catch (error) {
    console.error('[short-links] resolve failed', error);
    res.status(500).json({ error: 'Unable to resolve short link' });
  }
});

router.post('/short-links', auth, teacherOnly, async (req, res) => {
  const destinationUrl = normalizeShortLinkUrl(req.body?.url);
  if (!destinationUrl || destinationUrl.length > MAX_URL_LENGTH) {
    return res.status(400).json({ error: 'A valid HTTP(S) URL is required' });
  }

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomBytes(12).toString('base64url');
      const [result] = await pool.execute(
        'INSERT OR IGNORE INTO short_links (code, destination_url) VALUES (?, ?)',
        [code, destinationUrl]
      );
      if (result.affectedRows) return res.status(201).json({ code, url: destinationUrl });
    }
    res.status(503).json({ error: 'Unable to create a unique short link' });
  } catch (error) {
    console.error('[short-links] create failed', error);
    res.status(500).json({ error: 'Unable to create short link' });
  }
});

export default router;
