import { Router } from 'express';
import auth from '../middleware/auth.js';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';

const router = Router();
router.use(auth);

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 15000);
const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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

export default router;
