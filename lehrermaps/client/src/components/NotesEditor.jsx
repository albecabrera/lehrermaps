import { useRef, useEffect, useState, useCallback } from 'react';
import { saveFolderNotes } from '../lib/api';
import { useLang } from '../contexts/LangContext';

const DEBOUNCE_MS = 1500;

const HIGHLIGHT_COLORS = [
  '#FEF08A', '#BBF7D0', '#BAE6FD', '#F9A8D4', '#FED7AA', '#E9D5FF',
];
const TEXT_COLORS = [
  '#DC2626', '#16A34A', '#2563EB', '#9333EA', '#F97316', '#0891B2', '#CA8A04',
];

// ── Inline markdown (typed closing delimiter → format) ────────────────────
const INLINE_PATTERNS = [
  [/\*\*([^*\n]+)\*\*$/, (t) => `<strong>${t}</strong>`],
  [/__([^_\n]+)__$/, (t) => `<strong>${t}</strong>`],
  [/\*([^*\n]+)\*$/, (t) => `<em>${t}</em>`],
  [/_([^_\n]+)_$/, (t) => `<em>${t}</em>`],
  [/~~([^~\n]+)~~$/, (t) => `<s>${t}</s>`],
  [/`([^`\n]+)`$/, (t) => `<code>${t}</code>`],
];

function tryInlineMarkdown(editor) {
  if (!editor) return false;
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return false;
  const before = node.textContent.slice(0, range.startOffset);
  for (const [re, html] of INLINE_PATTERNS) {
    const m = before.match(re);
    if (!m) continue;
    const r = document.createRange();
    r.setStart(node, range.startOffset - m[0].length);
    r.setEnd(node, range.startOffset);
    sel.removeAllRanges();
    sel.addRange(r);
    document.execCommand('insertHTML', false, html(m[1]));
    return true;
  }
  return false;
}

// ── Block markdown conversion ──────────────────────────────────────────────
function tryMarkdownConvert(key, editor) {
  if (!editor) return false;
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return false;

  const range = sel.getRangeAt(0);
  let node = range.startContainer;
  while (node && node.parentNode !== editor) node = node.parentNode;
  if (!node || node === editor) return false;

  const block = node;
  const text = block.textContent;

  const clearBlock = () => {
    const r = document.createRange();
    r.selectNodeContents(block);
    sel.removeAllRanges();
    sel.addRange(r);
    document.execCommand('delete', false);
  };

  if (key === 'Enter') {
    if (text === '#')   { clearBlock(); document.execCommand('formatBlock', false, 'h1'); return true; }
    if (text === '##')  { clearBlock(); document.execCommand('formatBlock', false, 'h2'); return true; }
    if (text === '###') { clearBlock(); document.execCommand('formatBlock', false, 'h3'); return true; }
    if (text === '-' || text === '*') { clearBlock(); document.execCommand('insertUnorderedList', false); return true; }
    if (/^1\.$/.test(text)) { clearBlock(); document.execCommand('insertOrderedList', false); return true; }
    if (text === '>') { clearBlock(); document.execCommand('formatBlock', false, 'blockquote'); return true; }
    if (text === '```') { clearBlock(); document.execCommand('formatBlock', false, 'pre'); return true; }
    if (/^-{3,}$/.test(text.trim())) { clearBlock(); document.execCommand('insertHorizontalRule', false); return true; }
  }

  if (key === ' ') {
    if (text === '#')   { clearBlock(); document.execCommand('formatBlock', false, 'h1'); return true; }
    if (text === '##')  { clearBlock(); document.execCommand('formatBlock', false, 'h2'); return true; }
    if (text === '###') { clearBlock(); document.execCommand('formatBlock', false, 'h3'); return true; }
    if (text === '-' || text === '*') { clearBlock(); document.execCommand('insertUnorderedList', false); return true; }
    if (/^1\.$/.test(text)) { clearBlock(); document.execCommand('insertOrderedList', false); return true; }
    if (text === '>') { clearBlock(); document.execCommand('formatBlock', false, 'blockquote'); return true; }
    if (text === '```') { clearBlock(); document.execCommand('formatBlock', false, 'pre'); return true; }
  }

  return false;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function NotesEditor({ folderId, folderName, initialContent, accent = '#E8472A' }) {
  const { t } = useLang();
  const editorRef = useRef(null);
  const timerRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [activeFormats, setActiveFormats] = useState({});
  const [showHL, setShowHL] = useState(false);
  const [showTC, setShowTC] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = initialContent || '';
    setSaveStatus('idle');
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        if (editorRef.current) {
          saveFolderNotes(folderId, editorRef.current.innerHTML).catch(() => {});
        }
      }
    };
  }, [folderId]);

  useEffect(() => {
    const update = () => {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      });
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, []);

  // close color pickers on outside click
  useEffect(() => {
    const handler = () => { setShowHL(false); setShowTC(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = useCallback(() => {
    clearTimeout(timerRef.current);
    setSaveStatus('saving');
    timerRef.current = setTimeout(async () => {
      if (!editorRef.current) return;
      try {
        await saveFolderNotes(folderId, editorRef.current.innerHTML);
        setSaveStatus('saved');
      } catch { setSaveStatus('idle'); }
    }, DEBOUNCE_MS);
  }, [folderId]);

  const handlePrint = useCallback(() => {
    const content = editorRef.current?.innerHTML || '';
    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(`<!DOCTYPE html><html><head><title>${folderName || 'Notizen'}</title>
      <style>
        body{font-family:'DM Sans',sans-serif;padding:32px 48px;max-width:800px;margin:0 auto;color:#111;line-height:1.7}
        h1{font-size:1.8em;font-weight:700;margin:.6em 0 .3em}h2{font-size:1.4em;font-weight:600;margin:.5em 0 .25em}
        h3{font-size:1.15em;font-weight:600;margin:.4em 0 .2em}p{margin:.3em 0}
        ul{list-style:disc;padding-left:1.6em;margin:.3em 0}ol{list-style:decimal;padding-left:1.6em;margin:.3em 0}
        li{margin:.15em 0}blockquote{border-left:3px solid #ddd;margin:.5em 0;padding-left:1em;color:#555}
        pre{background:#f4f4f5;border-radius:6px;padding:12px 14px;font-family:monospace;font-size:.9em;overflow-x:auto}
        code{background:#f4f4f5;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:.9em}
        hr{border:none;border-top:2px solid #e5e7eb;margin:1.2em 0}
        @page{margin:2cm}
      </style></head><body>${content}</body></html>`);
    w.document.close(); w.focus(); w.print(); w.close();
  }, [folderName]);

  const exec = useCallback((cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const fmtBlock = useCallback((tag) => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
    editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const insertLink = useCallback(() => {
    const sel = window.getSelection();
    const defaultText = sel?.toString() || '';
    const url = window.prompt('URL:', 'https://');
    if (!url?.trim()) return;
    editorRef.current?.focus();
    if (defaultText) {
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`);
    }
    editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const insertCheckbox = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false,
      '<div class="lm-task"><input type="checkbox"><span>Aufgabe</span></div>');
    editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const insertInlineCode = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString() || 'code';
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, `<code>${text}</code>`);
    editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const handleKeyDown = useCallback((e) => {
    // Inline markdown: fire after the closing delimiter is inserted
    if (['*', '_', '~', '`'].includes(e.key)) {
      setTimeout(() => {
        if (tryInlineMarkdown(editorRef.current)) {
          editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 0);
    }
    if (e.key === ' ' || e.key === 'Enter') {
      const converted = tryMarkdownConvert(e.key, editorRef.current);
      if (converted) {
        e.preventDefault();
        editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      insertLink();
    }
  }, [insertLink]);

  const on = (key) => activeFormats[key];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>
      {/* Toolbar */}
      <div style={{
        background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)',
        padding: '5px 10px', display: 'flex', alignItems: 'center',
        gap: 2, flexWrap: 'wrap', flexShrink: 0,
      }}>
        {/* Undo / Redo */}
        <ToolBtn title={t('notes.undo')} onClick={() => exec('undo')}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 5H8a3 3 0 0 1 0 6H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 5l2.5-2.5M2 5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </ToolBtn>
        <ToolBtn title={t('notes.redo')} onClick={() => exec('redo')}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M11 5H5a3 3 0 0 0 0 6h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 5l-2.5-2.5M11 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </ToolBtn>

        <Divider />

        {/* Format select */}
        <select
          onChange={(e) => { fmtBlock(e.target.value); e.target.value = ''; }}
          defaultValue=""
          style={{
            height: 26, border: '1px solid var(--c-border)', borderRadius: 5,
            background: 'var(--c-input-bg)', color: 'var(--c-text)',
            fontSize: 11, padding: '0 6px', cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
          }}
        >
          <option value="" disabled>{t('notes.format_normal')}</option>
          <option value="p">{t('notes.format_normal')}</option>
          <option value="h1">{t('notes.format_h1')}</option>
          <option value="h2">{t('notes.format_h2')}</option>
          <option value="h3">{t('notes.format_h3')}</option>
          <option value="blockquote">Zitat</option>
          <option value="pre">Code-Block</option>
        </select>

        <Divider />

        {/* B / I / U / S */}
        <ToolBtn title={t('notes.bold')} active={on('bold')} accent={accent} onClick={() => exec('bold')}>
          <span style={{ fontWeight: 700, fontSize: 12 }}>B</span>
        </ToolBtn>
        <ToolBtn title={t('notes.italic')} active={on('italic')} accent={accent} onClick={() => exec('italic')}>
          <span style={{ fontStyle: 'italic', fontSize: 12 }}>I</span>
        </ToolBtn>
        <ToolBtn title={t('notes.underline')} active={on('underline')} accent={accent} onClick={() => exec('underline')}>
          <span style={{ textDecoration: 'underline', fontSize: 12 }}>U</span>
        </ToolBtn>
        <ToolBtn title={t('notes.strikethrough')} active={on('strikeThrough')} accent={accent} onClick={() => exec('strikeThrough')}>
          <span style={{ textDecoration: 'line-through', fontSize: 12 }}>S</span>
        </ToolBtn>
        {/* Inline code */}
        <ToolBtn title="Code (inline)" onClick={insertInlineCode}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M4.5 3L1 6.5 4.5 10M8.5 3L12 6.5 8.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </ToolBtn>

        <Divider />

        {/* Text color */}
        <div style={{ position: 'relative' }} onMouseDown={(e) => e.stopPropagation()}>
          <ToolBtn title="Textfarbe" onClick={() => { setShowTC((v) => !v); setShowHL(false); }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>A</span>
              <div style={{ width: 12, height: 3, borderRadius: 1, background: accent }} />
            </div>
          </ToolBtn>
          {showTC && (
            <ColorPicker
              colors={TEXT_COLORS}
              onSelect={(c) => { exec('foreColor', c || 'var(--c-text)'); setShowTC(false); }}
              extraLabel="Standard"
              extraColor=""
            />
          )}
        </div>

        {/* Highlight */}
        <div style={{ position: 'relative' }} onMouseDown={(e) => e.stopPropagation()}>
          <ToolBtn title="Markieren" onClick={() => { setShowHL((v) => !v); setShowTC(false); }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <svg width="10" height="11" viewBox="0 0 10 11" fill="none">
                <path d="M2 8l1.5-4 3.5 3.5L3.5 9z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M5 5.5l2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <div style={{ width: 12, height: 3, borderRadius: 1, background: '#FEF08A' }} />
            </div>
          </ToolBtn>
          {showHL && (
            <ColorPicker
              colors={HIGHLIGHT_COLORS}
              onSelect={(c) => {
                exec('hiliteColor', c || 'transparent');
                setShowHL(false);
              }}
              extraLabel="Keine"
              extraColor="transparent"
              showExtra
            />
          )}
        </div>

        <Divider />

        {/* Align */}
        <ToolBtn title={t('notes.align_left')} active={on('justifyLeft')} accent={accent} onClick={() => exec('justifyLeft')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><path d="M1 1h11M1 4h7M1 7h11M1 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </ToolBtn>
        <ToolBtn title={t('notes.align_center')} active={on('justifyCenter')} accent={accent} onClick={() => exec('justifyCenter')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><path d="M1 1h11M3 4h7M1 7h11M3 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </ToolBtn>
        <ToolBtn title={t('notes.align_right')} active={on('justifyRight')} accent={accent} onClick={() => exec('justifyRight')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><path d="M1 1h11M5 4h7M1 7h11M5 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </ToolBtn>

        <Divider />

        {/* Lists */}
        <ToolBtn title={t('notes.bullets')} active={on('insertUnorderedList')} accent={accent} onClick={() => exec('insertUnorderedList')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><circle cx="1.5" cy="2" r="1" fill="currentColor"/><circle cx="1.5" cy="5.5" r="1" fill="currentColor"/><circle cx="1.5" cy="9" r="1" fill="currentColor"/><path d="M4 2h8M4 5.5h8M4 9h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </ToolBtn>
        <ToolBtn title={t('notes.numbered_list')} active={on('insertOrderedList')} accent={accent} onClick={() => exec('insertOrderedList')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none">
            <text x="0" y="3.5" style={{fontSize:4, fontFamily:'monospace'}} fill="currentColor">1.</text>
            <text x="0" y="7" style={{fontSize:4, fontFamily:'monospace'}} fill="currentColor">2.</text>
            <text x="0" y="10.5" style={{fontSize:4, fontFamily:'monospace'}} fill="currentColor">3.</text>
            <path d="M5 2h7M5 5.5h7M5 9h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </ToolBtn>
        {/* Checkbox/task */}
        <ToolBtn title="Aufgabe (Checkbox)" onClick={insertCheckbox}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M3.5 6.5l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </ToolBtn>

        <Divider />

        {/* Indent / Outdent */}
        <ToolBtn title="Einrücken" onClick={() => exec('indent')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><path d="M1 1h11M5 4h7M1 7h11M5 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M1 5.5l2.5-2v4z" fill="currentColor"/></svg>
        </ToolBtn>
        <ToolBtn title="Ausrücken" onClick={() => exec('outdent')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><path d="M1 1h11M5 4h7M1 7h11M5 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M4 5.5L1.5 3.5v4z" fill="currentColor"/></svg>
        </ToolBtn>

        <Divider />

        {/* Link */}
        <ToolBtn title="Link (⌘K)" onClick={insertLink}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M5 8l-1.5 1.5a2.5 2.5 0 0 1-3.536-3.536L2.5 3.5A2.5 2.5 0 0 1 5.914 4.086" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M8 5l1.5-1.5a2.5 2.5 0 0 1 3.536 3.536L11.5 8.5A2.5 2.5 0 0 1 8.086 7.914" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M4.5 8.5l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </ToolBtn>

        {/* HR */}
        <ToolBtn title="Trennlinie" onClick={() => exec('insertHorizontalRule')}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1 6.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M4 3.5h5M4 9.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.4"/>
          </svg>
        </ToolBtn>

        <Divider />

        {/* Clear format */}
        <ToolBtn title={t('notes.clear_format')} onClick={() => exec('removeFormat')}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2l9 9M8 3l1 1-5 5-1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M4 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </ToolBtn>

        {/* Print */}
        <ToolBtn title={t('notes.print')} onClick={handlePrint}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="2" y="5" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 9h5M4 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <circle cx="9.5" cy="7" r=".75" fill="currentColor"/>
          </svg>
        </ToolBtn>

        {/* Save status */}
        <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--c-text-3)', fontFamily: '"DM Mono", monospace', whiteSpace: 'nowrap' }}>
          {saveStatus === 'saving' && t('notes.saving')}
          {saveStatus === 'saved' && t('notes.saved')}
        </div>
      </div>

      {/* Markdown hint bar */}
      <div style={{
        background: 'var(--c-surface-2)', borderBottom: '1px solid var(--c-border)',
        padding: '3px 14px', display: 'flex', gap: 12, flexWrap: 'wrap', flexShrink: 0,
      }}>
        {[
          ['#↩', 'H1'], ['##↩', 'H2'], ['###↩', 'H3'],
          ['-↩', 'Liste'], ['>↩', 'Zitat'], ['---↩', 'Linie'],
          ['**text**', 'Fett'], ['*text*', 'Kursiv'],
          ['~~text~~', 'Durch.'], ['`text`', 'Code'],
        ].map(([md, label]) => (
          <span key={md} style={{ fontSize: 10, color: 'var(--c-text-3)', display: 'flex', gap: 4, alignItems: 'center' }}>
            <code style={{
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              borderRadius: 3, padding: '0 4px', fontSize: 9,
              fontFamily: '"DM Mono", monospace', color: 'var(--c-text-2)',
            }}>{md}</code>
            <span>{label}</span>
          </span>
        ))}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="lm-notes-editor"
        data-placeholder={t('notes.placeholder')}
        style={{
          flex: 1, overflow: 'auto', padding: '20px 24px',
          outline: 'none', color: 'var(--c-text)',
          fontSize: 14, lineHeight: 1.7,
          fontFamily: '"DM Sans", -apple-system, sans-serif',
        }}
      />
    </div>
  );
}

function ColorPicker({ colors, onSelect, extraLabel, extraColor, showExtra }) {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', top: 32, left: 0, zIndex: 1200,
        background: 'var(--c-surface)', border: '1px solid var(--c-border-soft)',
        borderRadius: 8, padding: 8, boxShadow: 'var(--c-shadow-pop)',
        display: 'flex', flexWrap: 'wrap', gap: 4, width: 120,
        animation: 'lmSlideUp .12s ease-out',
        fontFamily: '"DM Sans", -apple-system, sans-serif',
      }}
    >
      {colors.map((c) => (
        <button
          key={c}
          title={c}
          onMouseDown={() => onSelect(c)}
          style={{
            width: 20, height: 20, borderRadius: 4, cursor: 'pointer',
            border: '1px solid var(--c-border)',
            background: c === 'transparent' ? 'var(--c-surface-2)' : c,
            flexShrink: 0,
          }}
        />
      ))}
      {showExtra && (
        <button
          onMouseDown={() => onSelect(extraColor)}
          style={{
            height: 20, padding: '0 6px', borderRadius: 4, cursor: 'pointer',
            border: '1px solid var(--c-border)', background: 'transparent',
            fontSize: 10, color: 'var(--c-text-2)', fontFamily: 'inherit',
          }}
        >{extraLabel}</button>
      )}
    </div>
  );
}

function ToolBtn({ children, onClick, title, active, accent }) {
  return (
    <button
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        width: 28, height: 26, border: active ? `1px solid ${accent}55` : '1px solid transparent',
        borderRadius: 5, background: active ? `${accent}18` : 'transparent',
        color: active ? accent : 'var(--c-text-2)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .1s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--c-hover)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: 'var(--c-border)', margin: '0 3px' }} />;
}
