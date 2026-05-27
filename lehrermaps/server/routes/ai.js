import { Router } from 'express';
import { spawn } from 'child_process';
import auth from '../middleware/auth.js';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';

const CLAUDE_CLI = process.env.CLAUDE_CLI_PATH || '/opt/homebrew/bin/claude';

function getClaudeSpawnOptions() {
  const filteredEnv = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith('MCP_'))
  );
  const projectCwd = process.env.CLAUDE_WORKDIR || process.cwd();
  return {
    env: {
      ...filteredEnv,
      PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:' + (process.env.PATH || ''),
      HOME: process.env.HOME || '/tmp',
    },
    cwd: projectCwd,
  };
}

function generateWithClaudeCLI({ system, user, fallback }) {
  return new Promise((resolve) => {
    const args = ['-p', '--output-format', 'text', '--dangerously-skip-permissions'];

    console.log('[claude-cli] spawning:', CLAUDE_CLI, args.join(' '));

    const proc = spawn(CLAUDE_CLI, args, getClaudeSpawnOptions());

    let out = '';
    let errOut = '';
    proc.stdin.on('error', () => {});
    proc.stdin.write(system ? `${system}\n\n---\n\n${user}` : user);
    proc.stdin.end();
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { errOut += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      console.error('[claude-cli] timeout after 120s');
      resolve(fallback);
    }, 120000);

    proc.on('error', (e) => {
      clearTimeout(timer);
      console.error('[claude-cli] spawn error:', e.message);
      resolve(fallback);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      console.log(`[claude-cli] exit code=${code}, out=${out.length} chars`);
      if (errOut) console.error('[claude-cli] stderr:', errOut.slice(0, 800));
      if (code === 0 && out.trim()) {
        resolve(out.trim());
      } else {
        resolve(fallback);
      }
    });
  });
}

const router = Router();
router.use(auth);

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 15000);
const WORKSHEET_TIMEOUT_MS = Number(process.env.WORKSHEET_TIMEOUT_MS || 45000);
const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5';

router.get('/status', (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nur für Lehrkräfte verfügbar.' });
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  res.json({
    provider: 'openai-compatible',
    model: AI_MODEL,
    configured: hasKey,
    canGenerate: hasKey,
    authMode: 'server_env',
  });
});

router.post('/status/test', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nur für Lehrkräfte verfügbar.' });
  const startedAt = Date.now();
  const fallback = 'pong';
  const content = await generateWithAI({
    system: 'Respond with a single short word.',
    user: 'ping',
    fallback,
  });
  const latencyMs = Date.now() - startedAt;
  const ok = content && content !== fallback ? true : Boolean(process.env.OPENAI_API_KEY);
  res.json({
    ok,
    model: AI_MODEL,
    latencyMs,
    response: String(content || '').slice(0, 60),
  });
});

router.post('/generate-document', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nur für Lehrkräfte verfügbar.' });
  const { type = 'docx', prompt = '', subject = '', folderName = '', lang = 'es' } = req.body || {};
  const outType = String(type).toLowerCase();
  if (!['doc', 'docx', 'pdf', 'pptx'].includes(outType)) {
    return res.status(400).json({ error: 'type debe ser doc|docx|pdf|pptx.' });
  }
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt obligatorio.' });

  try {
    const { content, usage } = await generateDocumentContent({ prompt, subject, folderName, lang });
    const { fileName, mimeType, buffer } = await buildBinary({ outType, content, subject, folderName });
    return res.json({
      fileName,
      mimeType,
      base64: buffer.toString('base64'),
      usage: usage || null,
      model: AI_MODEL,
    });
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo generar el documento.', details: String(err?.message || err) });
  }
});

router.post('/lesson-draft', async (req, res) => {
  if (req.user?.role !== 'lehrer') {
    return res.status(403).json({ error: 'Nur für Lehrkräfte verfügbar.' });
  }

  const {
    subject = '',
    folderName = '',
    files = [],
    lang = 'es',
    level = 'Secundaria',
    durationMin = 45,
    classType = 'mixta',
  } = req.body || {};

  if (!subject || !folderName) {
    return res.status(400).json({ error: 'subject y folderName son obligatorios.' });
  }
  if (!Array.isArray(files)) {
    return res.status(400).json({ error: 'files debe ser un array.' });
  }

  try {
    const fileList = files.slice(0, 30).map((f) => `- ${String(f).trim()}`).join('\n') || '- (sin archivos)';
    const content = await generateWithAI({
      system: 'Sos un asistente pedagógico experto. Respondé solo con Markdown limpio y útil para clase.',
      user: [
        `Idioma de salida: ${lang}`,
        `Asignatura: ${subject}`,
        `Carpeta/Unidad: ${folderName}`,
        `Nivel: ${level}`,
        `Duración: ${durationMin} minutos`,
        `Tipo de clase: ${classType}`,
        'Archivos disponibles:',
        fileList,
        '',
        'Generá: tema, objetivos, secuencia minuto a minuto, actividad práctica, evaluación formativa y tarea.',
      ].join('\n'),
      fallback: buildLocalDraft({ subject, folderName, files, lang, level, durationMin, classType }),
    });

    if (!content) {
      return res.status(502).json({
        error: 'Respuesta IA vacía.',
        fallback: buildLocalDraft({ subject, folderName, files, lang, level, durationMin, classType }),
      });
    }

    return res.json({ draft: content, provider: 'openai', model: AI_MODEL });
  } catch (err) {
    return res.status(500).json({
      error: 'Error interno generando borrador IA.',
      details: String(err?.message || err || ''),
      fallback: buildLocalDraft({ subject, folderName, files, lang, level, durationMin, classType }),
    });
  }
});

async function generateDocumentContent({ prompt, subject, folderName, lang }) {
  const fallback = [
    `# ${subject || 'Documento'}`,
    '',
    `Unidad: ${folderName || '-'}`,
    '',
    prompt.trim(),
  ].join('\n');
  const ai = await generateWithAIWithUsage({
    system: 'Sos un asistente que redacta contenido didáctico listo para exportar. Respondé en markdown claro.',
    user: [
      `Idioma: ${lang}`,
      `Asignatura: ${subject}`,
      `Unidad/Carpeta: ${folderName}`,
      `Solicitud del docente: ${prompt}`,
    ].join('\n'),
    fallback,
  });
  return ai;
}

async function generateWithClaudeWebSearch({ system, user, fallback }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKSHEET_TIMEOUT_MS);

  const messages = [{ role: 'user', content: user }];

  try {
    for (let turn = 0; turn < 6; turn++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'web-search-2025-03-05',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 4096,
          system,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
          messages,
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        console.error('Anthropic error:', err?.error?.message || r.status);
        return fallback;
      }

      const data = await r.json();
      const content = data.content || [];

      if (data.stop_reason === 'end_turn') {
        const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('');
        return text || fallback;
      }

      if (data.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content });
        const toolResults = content
          .filter((b) => b.type === 'tool_use')
          .map((b) => ({ type: 'tool_result', tool_use_id: b.id, content: b.output ?? '' }));
        if (toolResults.length) messages.push({ role: 'user', content: toolResults });
        continue;
      }

      break;
    }
    return fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

async function generateWithAI({ system, user, fallback }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.5,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!r.ok) return fallback;
    const data = await r.json();
    return data?.choices?.[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

async function generateWithAIWithUsage({ system, user, fallback }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { content: fallback, usage: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.5,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!r.ok) return { content: fallback, usage: null };
    const data = await r.json();
    return {
      content: data?.choices?.[0]?.message?.content?.trim() || fallback,
      usage: data?.usage || null,
    };
  } catch {
    return { content: fallback, usage: null };
  } finally {
    clearTimeout(timer);
  }
}

async function buildBinary({ outType, content, subject, folderName }) {
  const cleanBase = slug(`${subject || 'documento'}-${folderName || 'archivo'}`);
  const safe = content.replace(/\r\n/g, '\n');
  if (outType === 'doc') {
    return {
      fileName: `${cleanBase}.doc`,
      mimeType: 'application/msword',
      buffer: Buffer.from(safe, 'utf8'),
    };
  }
  if (outType === 'docx') {
    const paragraphs = toParagraphs(safe);
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: subject || 'Documento', heading: HeadingLevel.HEADING_1 }),
          ...paragraphs,
        ],
      }],
    });
    const buffer = await Packer.toBuffer(doc);
    return {
      fileName: `${cleanBase}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer,
    };
  }
  if (outType === 'pdf') {
    const buffer = await pdfBufferFromText(safe);
    return {
      fileName: `${cleanBase}.pdf`,
      mimeType: 'application/pdf',
      buffer,
    };
  }
  const buffer = await pptxBufferFromText({ title: subject || 'Presentación', content: safe });
  return {
    fileName: `${cleanBase}.pptx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    buffer,
  };
}

function toParagraphs(text) {
  return text.split('\n').map((line) =>
    new Paragraph({
      children: [new TextRun(line || ' ')],
      spacing: { after: 120 },
    })
  );
}

function pdfBufferFromText(text) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(11).text(text, { width: 500, align: 'left' });
    doc.end();
  });
}

async function pptxBufferFromText({ title, content }) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const lines = content.split('\n').filter(Boolean);
  const slide1 = pptx.addSlide();
  slide1.addText(title, { x: 0.6, y: 0.4, w: 12, h: 0.6, bold: true, fontSize: 28 });
  const bullets = lines.slice(0, 10).map((line) => ({ text: line.replace(/^[-*]\s*/, '') }));
  slide1.addText(bullets, { x: 0.8, y: 1.3, w: 11.8, h: 5.5, fontSize: 18, bullet: { indent: 18 } });
  const arrBuf = await pptx.write({ outputType: 'arraybuffer' });
  return Buffer.from(arrBuf);
}

function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'documento';
}

function buildLocalDraft({ subject, folderName, files, lang, level, durationMin, classType }) {
  const resources = files.slice(0, 12).map((f) => `- ${String(f).trim()}`).join('\n') || '- (sin recursos aún)';
  return [
    `# Plan de clase (${subject})`,
    '',
    `- Unidad: ${folderName}`,
    `- Nivel: ${level}`,
    `- Duración: ${durationMin} min`,
    `- Modalidad: ${classType}`,
    `- Idioma: ${lang}`,
    '',
    '## Objetivos',
    '- Comprender los conceptos clave.',
    '- Aplicarlos en una actividad guiada.',
    '- Verificar comprensión con evaluación breve.',
    '',
    '## Recursos disponibles',
    resources,
    '',
    '## Secuencia sugerida',
    '- 0-10 min: activación de conocimientos previos.',
    '- 10-30 min: desarrollo guiado con recursos.',
    '- 30-40 min: práctica individual o en parejas.',
    '- 40-45 min: cierre y ticket de salida.',
    '',
    '## Evaluación formativa',
    '- Lista de cotejo rápida (3 criterios).',
    '- Pregunta de metacognición final.',
  ].join('\n');
}

const WORKSHEET_TYPE_LABELS = {
  exercises: 'Offene Aufgaben (freie Antworten)',
  lueckentext: 'Lückentext (Fill in the blank)',
  multiple: 'Multiple Choice (4 Optionen A/B/C/D)',
  aufsatz: 'Schreibaufgabe / Aufsatz',
  gemischt: 'Gemischte Aufgaben (verschiedene Typen)',
  vokabular: 'Vokabelliste / Hoja de vocabulario',
};

function buildWorksheetSystem(langName, hasAnthropicKey) {
  return `Du bist ein erfahrener Lehrer und erstellst professionelle, druckfertige Arbeitsblätter.
${hasAnthropicKey ? 'Nutze die Web-Suche, um aktuellen und korrekten Inhalt zu finden, bevor du das Arbeitsblatt erstellst.' : ''}
Schreibe das gesamte Arbeitsblatt auf ${langName}.
Struktur (immer einhalten):
1. Titel-Block: # [Titel], darunter: **Name:** _____________  **Klasse:** _____________  **Datum:** _____________
2. Horizontale Linie (---)
3. **Lernziele:** 2–3 Stichpunkte
4. Horizontale Linie
5. Nummerierte Aufgaben (### Aufgabe N) mit genug Platz für Antworten
6. Fußzeile: *Erstellt von: _____________ | Datum: _____________*
Ausgabe: NUR das fertige Arbeitsblatt in Markdown. Kein erklärender Text davor oder danach.`;
}

router.post('/worksheet/stream', (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nur für Lehrkräfte.' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => { try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {} };

  const { prompt = '', lang = 'de' } = req.body || {};
  if (!prompt?.trim()) { send({ type: 'error', message: 'Prompt fehlt.' }); return res.end(); }

  const langName = lang === 'es' ? 'Spanisch' : lang === 'en' ? 'Englisch' : 'Deutsch';
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const system = buildWorksheetSystem(langName, false);
  const fallback = [
    '# Arbeitsblatt',
    '',
    '**Name:** _____________  **Klasse:** _____________  **Datum:** _____________',
    '',
    '---',
    '',
    '**Lernziele:**',
    '- Inhalte verstehen',
    '- Grundlegende Konzepte anwenden',
    '',
    '---',
    '',
    '### Aufgabe 1',
    '',
    '_Aufgabe hier._',
    '',
    '_________________________________________',
    '',
  ].join('\n');

  const args = ['-p', '--output-format', 'text', '--dangerously-skip-permissions'];
  const proc = spawn(CLAUDE_CLI, args, getClaudeSpawnOptions());

  proc.stdin.on('error', () => {});
  proc.stdin.write(`${system}\n\n---\n\n${prompt.trim()}`);
  proc.stdin.end();

  let fullText = '';
  proc.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    fullText += text;
    send({ type: 'text', text, chars: fullText.length });
  });
  proc.stderr.on('data', (d) => { console.error('[stream-cli] stderr:', d.toString().slice(0, 500)); });

  const timer = setTimeout(() => { proc.kill('SIGTERM'); send({ type: 'timeout' }); res.end(); }, 120000);

  proc.on('error', (e) => { clearTimeout(timer); send({ type: 'error', message: e.message }); res.end(); });
  proc.on('close', async (code, signal) => {
    clearTimeout(timer);
    console.log(`[stream-cli] close code=${code} signal=${signal} chars=${fullText.length}`);
    if (code === 0 && fullText.trim()) {
      send({ type: 'done', content: fullText.trim() });
      res.end();
      return;
    }
    try {
      const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
      const looksLikeNotLoggedIn = /not logged in|please run \/login/i.test(fullText);
      if (!hasAnthropicKey && !hasOpenAiKey && looksLikeNotLoggedIn) {
        send({
          type: 'error',
          message: 'Claude CLI ist nicht angemeldet und es gibt keinen ANTHROPIC_API_KEY/OPENAI_API_KEY. Bitte `claude` einloggen oder API-Key setzen.',
        });
        res.end();
        return;
      }
      // Fallback chain identical to /worksheet endpoint (without streaming tokens).
      let content = fallback;
      if (hasAnthropicKey) {
        content = await generateWithClaudeWebSearch({
          system: buildWorksheetSystem(langName, true),
          user: prompt.trim(),
          fallback,
        });
      } else {
        const result = await generateWithAIWithUsage({ system, user: prompt.trim(), fallback });
        content = result.content || fallback;
      }
      send({ type: 'done', content });
    } catch (e) {
      send({ type: 'error', message: `CLI fehlgeschlagen (code=${code} signal=${signal}) und Fallback auch fehlgeschlagen: ${String(e?.message || e)}` });
    }
    res.end();
  });
  req.on('close', () => { clearTimeout(timer); proc.kill('SIGTERM'); });
});

router.post('/worksheet', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nur für Lehrkräfte.' });
  const { prompt = '', lang = 'de' } = req.body || {};
  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt ist erforderlich.' });

  const langName = lang === 'es' ? 'Spanisch' : lang === 'en' ? 'Englisch' : 'Deutsch';
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const system = buildWorksheetSystem(langName, hasAnthropicKey);

  const fallback = [
    '# Arbeitsblatt',
    '',
    '**Name:** _____________  **Klasse:** _____________  **Datum:** _____________',
    '',
    '---',
    '',
    '**Lernziele:**',
    '- Inhalte verstehen',
    '- Grundlegende Konzepte anwenden',
    '',
    '---',
    '',
    '### Aufgabe 1',
    '',
    '_Aufgabe hier._',
    '',
    '_________________________________________',
    '',
  ].join('\n');

  // Priority: Claude CLI (Pro membership) → Anthropic API key → OpenAI → fallback
  const cliContent = await generateWithClaudeCLI({ system, user: prompt.trim(), fallback });
  if (cliContent && cliContent !== fallback) {
    return res.json({ content: cliContent, provider: 'claude-cli', usage: null });
  }
  if (hasAnthropicKey) {
    const content = await generateWithClaudeWebSearch({ system, user: prompt.trim(), fallback });
    return res.json({ content, provider: 'claude', usage: null });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'Kein KI-Provider verfügbar: Claude CLI ist nicht angemeldet und es gibt keinen ANTHROPIC_API_KEY/OPENAI_API_KEY.',
      hint: 'Bitte `claude` einloggen oder API-Key in der Server-Umgebung setzen.',
    });
  }
  const result = await generateWithAIWithUsage({ system, user: prompt.trim(), fallback });
  return res.json({ content: result.content, provider: 'openai', usage: result.usage || null });
});

router.post('/worksheet/export', async (req, res) => {
  if (req.user?.role !== 'lehrer') return res.status(403).json({ error: 'Nur für Lehrkräfte.' });
  const { content = '', format = 'pdf', subject = '', topic = '' } = req.body || {};
  if (!content?.trim()) return res.status(400).json({ error: 'content obligatorio.' });

  const outType = format === 'docx' ? 'docx' : 'pdf';
  const title = [subject, topic].filter(Boolean).join(' — ') || 'Arbeitsblatt';
  const fileName = slug(title) + '.' + outType;

  try {
    let buffer;
    if (outType === 'docx') {
      buffer = await worksheetToDocx(content, title);
    } else {
      buffer = await worksheetToPdf(content);
    }
    const mimeType = outType === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';
    return res.json({ fileName, mimeType, base64: buffer.toString('base64') });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

function parseInlineMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((p) => {
    if (p.startsWith('**') && p.endsWith('**')) return new TextRun({ text: p.slice(2, -2), bold: true });
    return new TextRun(p);
  });
}

async function worksheetToDocx(markdown, title) {
  const lines = markdown.split('\n');
  const children = [];
  for (const line of lines) {
    if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: line.slice(2).trim(), heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }));
    } else if (line.startsWith('## ') || line.startsWith('### ')) {
      const lvl = line.startsWith('### ') ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2;
      const txt = line.replace(/^#{2,3} /, '').trim();
      children.push(new Paragraph({ text: txt, heading: lvl, spacing: { before: 200, after: 100 } }));
    } else if (/^-{3,}$/.test(line.trim())) {
      children.push(new Paragraph({ text: '', spacing: { after: 120 }, border: { bottom: { color: 'AAAAAA', size: 6, space: 1, style: 'single' } } }));
    } else if (line.trim() === '') {
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    } else {
      const runs = parseInlineMarkdown(line);
      children.push(new Paragraph({ children: runs, spacing: { after: 80 } }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

function worksheetToPdf(markdown) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const lines = markdown.split('\n');
    for (const line of lines) {
      if (line.startsWith('# ')) {
        doc.fontSize(18).font('Helvetica-Bold').text(line.slice(2).trim(), { paragraphGap: 6 });
        doc.font('Helvetica');
      } else if (line.startsWith('## ') || line.startsWith('### ')) {
        const sz = line.startsWith('## ') ? 14 : 12;
        doc.fontSize(sz).font('Helvetica-Bold').text(line.replace(/^#{2,3} /, '').trim(), { paragraphGap: 4 });
        doc.font('Helvetica');
      } else if (/^-{3,}$/.test(line.trim())) {
        doc.moveDown(0.3);
        const y = doc.y; doc.moveTo(48, y).lineTo(547, y).strokeColor('#AAAAAA').stroke();
        doc.moveDown(0.3);
      } else if (line.trim() === '') {
        doc.moveDown(0.5);
      } else {
        doc.fontSize(11).font('Helvetica').text(line.replace(/\*\*([^*]+)\*\*/g, '$1'), { paragraphGap: 3 });
      }
    }
    doc.end();
  });
}

export default router;
