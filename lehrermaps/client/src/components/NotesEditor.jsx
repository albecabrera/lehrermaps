import { useRef, useEffect, useState, useCallback } from 'react';
import { saveFolderNotes } from '../lib/api';
import { useLang } from '../contexts/LangContext';

const DEBOUNCE_MS = 1500;

export default function NotesEditor({ folderId, folderName, initialContent, accent = '#E8472A' }) {
  const { t } = useLang();
  const editorRef = useRef(null);
  const timerRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  const [activeFormats, setActiveFormats] = useState({});

  // Load content when folder changes — flush pending save first
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = initialContent || '';
    setSaveStatus('idle');

    return () => {
      // If timer is pending when folder changes, save immediately (fire & forget)
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        if (editorRef.current) {
          saveFolderNotes(folderId, editorRef.current.innerHTML).catch(() => {});
        }
      }
    };
  }, [folderId]);

  // Track active formats on selection change
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

  const handleInput = useCallback(() => {
    clearTimeout(timerRef.current);
    setSaveStatus('saving');
    timerRef.current = setTimeout(async () => {
      if (!editorRef.current) return;
      const content = editorRef.current.innerHTML;
      try {
        await saveFolderNotes(folderId, content);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
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
        @page{margin:2cm}
      </style></head><body>${content}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }, [folderName]);

  const exec = useCallback((cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const formatBlock = useCallback((tag) => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
    editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const handleKeyDown = (e) => {
    // Ctrl+B, I, U shortcuts already handled by browser in contenteditable
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      // execCommand undo is handled by browser
    }
  };

  const btnActive = (key) => activeFormats[key];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>
      {/* Toolbar */}
      <div style={{
        background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)',
        padding: '6px 10px', display: 'flex', alignItems: 'center',
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

        {/* Bold / Italic / Underline / Strike */}
        <ToolBtn title={t('notes.bold')} active={btnActive('bold')} accent={accent} onClick={() => exec('bold')}>
          <span style={{ fontWeight: 700, fontSize: 12 }}>B</span>
        </ToolBtn>
        <ToolBtn title={t('notes.italic')} active={btnActive('italic')} accent={accent} onClick={() => exec('italic')}>
          <span style={{ fontStyle: 'italic', fontSize: 12 }}>I</span>
        </ToolBtn>
        <ToolBtn title={t('notes.underline')} active={btnActive('underline')} accent={accent} onClick={() => exec('underline')}>
          <span style={{ textDecoration: 'underline', fontSize: 12 }}>U</span>
        </ToolBtn>
        <ToolBtn title={t('notes.strikethrough')} active={btnActive('strikeThrough')} accent={accent} onClick={() => exec('strikeThrough')}>
          <span style={{ textDecoration: 'line-through', fontSize: 12 }}>S</span>
        </ToolBtn>

        <Divider />

        {/* Format block */}
        <select
          onChange={(e) => { formatBlock(e.target.value); e.target.value = ''; }}
          defaultValue=""
          style={{
            height: 26, border: '1px solid var(--c-border)', borderRadius: 5,
            background: 'var(--c-input-bg)', color: 'var(--c-text)',
            fontSize: 11, padding: '0 6px', cursor: 'pointer', outline: 'none',
            fontFamily: 'inherit',
          }}
        >
          <option value="" disabled>{t('notes.format_normal')}</option>
          <option value="p">{t('notes.format_normal')}</option>
          <option value="h1">{t('notes.format_h1')}</option>
          <option value="h2">{t('notes.format_h2')}</option>
          <option value="h3">{t('notes.format_h3')}</option>
        </select>

        <Divider />

        {/* Align */}
        <ToolBtn title={t('notes.align_left')} active={btnActive('justifyLeft')} accent={accent} onClick={() => exec('justifyLeft')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><path d="M1 1h11M1 4h7M1 7h11M1 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </ToolBtn>
        <ToolBtn title={t('notes.align_center')} active={btnActive('justifyCenter')} accent={accent} onClick={() => exec('justifyCenter')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><path d="M1 1h11M3 4h7M1 7h11M3 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </ToolBtn>
        <ToolBtn title={t('notes.align_right')} active={btnActive('justifyRight')} accent={accent} onClick={() => exec('justifyRight')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><path d="M1 1h11M5 4h7M1 7h11M5 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </ToolBtn>

        <Divider />

        {/* Lists */}
        <ToolBtn title={t('notes.bullets')} active={btnActive('insertUnorderedList')} accent={accent} onClick={() => exec('insertUnorderedList')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><circle cx="1.5" cy="2" r="1" fill="currentColor"/><circle cx="1.5" cy="5.5" r="1" fill="currentColor"/><circle cx="1.5" cy="9" r="1" fill="currentColor"/><path d="M4 2h8M4 5.5h8M4 9h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </ToolBtn>
        <ToolBtn title={t('notes.numbered_list')} active={btnActive('insertOrderedList')} accent={accent} onClick={() => exec('insertOrderedList')}>
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none"><text x="0" y="3.5" style={{fontSize:4, fontFamily:'monospace'}} fill="currentColor">1.</text><text x="0" y="7" style={{fontSize:4, fontFamily:'monospace'}} fill="currentColor">2.</text><text x="0" y="10.5" style={{fontSize:4, fontFamily:'monospace'}} fill="currentColor">3.</text><path d="M5 2h7M5 5.5h7M5 9h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </ToolBtn>

        <Divider />

        {/* Clear formatting */}
        <ToolBtn title={t('notes.clear_format')} onClick={() => exec('removeFormat')}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2l9 9M8 3l1 1-5 5-1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M4 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </ToolBtn>

        <Divider />

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
