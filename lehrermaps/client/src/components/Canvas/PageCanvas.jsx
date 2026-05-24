import { useEffect, useRef, useState } from 'react';
import { useNotebook } from '../../contexts/NotebookContext';
import OneNoteRichEditor from './OneNoteRichEditor';

const NOTE_KEY = 'lm_editor_note';
const TABS = ['Inicio', 'Insertar', 'Dibujar', 'Vista', 'Cuaderno'];

export default function PageCanvas({ pageId }) {
  const {
    notebooks, sectionsByNotebook, pagesBySection,
    activeNotebookId, activeSectionId, activePageId,
    setActiveNotebookId, setActiveSectionId, setActivePageId,
    openNotebookEditor, openSectionEditor,
    createNotebookQuick, createSectionQuick, createPageQuick,
    renameNotebook, renameSection, renamePage,
  } = useNotebook();

  const [activeTab, setActiveTab] = useState('Start');
  const [noteText, setNoteText] = useState('');
  const [drawMode, setDrawMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notebookColWidth, setNotebookColWidth] = useState(230);
  const [pagesColWidth, setPagesColWidth] = useState(300);
  const [notebookCollapsed, setNotebookCollapsed] = useState(false);
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const editorRef = useRef(null);
  const historyRef = useRef(['']);
  const redoRef = useRef([]);
  const pendingCursorRef = useRef(null);

  useEffect(() => {
    const key = `${NOTE_KEY}:${pageId}`;
    const saved = localStorage.getItem(key) || '';
    setNoteText(saved);
    historyRef.current = [saved];
    redoRef.current = [];
  }, [pageId]);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = noteText || '<p><br/></p>';
  }, [pageId]);

  useEffect(() => {
    localStorage.setItem(`${NOTE_KEY}:${pageId}`, noteText);
  }, [noteText, pageId]);

  const nbId = activeNotebookId || notebooks[0]?.id || null;
  const sectionList = nbId ? (sectionsByNotebook[nbId] || []) : [];
  const effectiveSectionId = (activeSectionId && sectionList.some((s) => s.id === activeSectionId))
    ? activeSectionId
    : (sectionList[0]?.id || null);
  const visiblePages = effectiveSectionId ? (pagesBySection[effectiveSectionId] || []) : [];

  const pushHistory = (nextText) => {
    historyRef.current.push(nextText);
    if (historyRef.current.length > 120) historyRef.current.shift();
    redoRef.current = [];
  };

  const insertHtmlAtCursor = (html) => {
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || !editorRef.current?.contains(range.commonAncestorContainer)) {
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, html);
    } else {
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node;
      let lastNode = null;
      while ((node = temp.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    const next = editorRef.current?.innerHTML || '';
    pushHistory(next);
    setNoteText(next);
  };

  const insertSnippet = (snippet) => {
    editorRef.current?.focus();
    if (snippet === '__TABLE__') {
      insertHtmlAtCursor('<table style="border-collapse:collapse;width:100%;margin:6px 0;"><tbody><tr><td style="border:1px solid #c9ccd3;padding:6px;">&nbsp;</td><td style="border:1px solid #c9ccd3;padding:6px;">&nbsp;</td></tr><tr><td style="border:1px solid #c9ccd3;padding:6px;">&nbsp;</td><td style="border:1px solid #c9ccd3;padding:6px;">&nbsp;</td></tr></tbody></table><p></p>');
      return;
    }
    if (snippet === '__CODE__') {
      insertHtmlAtCursor('<pre style="background:#0f172a;color:#e2e8f0;padding:8px;border-radius:6px;"><code>code</code></pre><p></p>');
      return;
    }
    if (snippet === '__IMAGE__') {
      const url = window.prompt('Bild-URL eingeben:');
      if (!url) return;
      insertHtmlAtCursor(`<p><img src="${url}" alt="" style="max-width:100%;border:1px solid #d0d0d0;border-radius:6px;" /></p><p></p>`);
      return;
    }
    if (snippet === '__DIVIDER__') {
      insertHtmlAtCursor('<hr/><p></p>');
      return;
    }
    if (snippet === '__TODO__') {
      insertHtmlAtCursor('<p>☐ Aufgabe</p>');
      return;
    }
    if (snippet === '__HEADING__') {
      document.execCommand('formatBlock', false, 'h2');
      return;
    }
    insertHtmlAtCursor(`<p>${snippet}</p>`);
    pendingCursorRef.current = null;
  };

  const runCmd = (command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    const next = editorRef.current?.innerHTML || '';
    historyRef.current[historyRef.current.length - 1] = next;
    setNoteText(next);
  };

  const undo = () => {
    if (historyRef.current.length <= 1) return;
    const current = historyRef.current.pop();
    redoRef.current.push(current ?? '');
    const prev = historyRef.current[historyRef.current.length - 1] ?? '';
    setNoteText(prev);
  };

  const redo = () => {
    if (!redoRef.current.length) return;
    const next = redoRef.current.pop() ?? '';
    historyRef.current.push(next);
    setNoteText(next);
  };

  const onTextChange = () => {
    const value = editorRef.current?.innerHTML || '';
    setNoteText(value);
    historyRef.current[historyRef.current.length - 1] = value;
  };

  const clearNote = () => {
    pushHistory('');
    setNoteText('');
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  const renderTools = () => {
    if (activeTab === 'Zeichnen') {
      return (
        <>
          <ToolBtn onClick={() => setDrawMode((v) => !v)} label={drawMode ? '✍️' : '🖊'} sub={drawMode ? 'Ink ON' : 'Ink OFF'} />
          <ToolBtn onClick={() => insertSnippet('✍️ Zeichnung/Ink Notiz')} label="✎" sub="Ink note" />
          <ToolBtn onClick={undo} label="↶" sub="Undo" />
          <ToolBtn onClick={redo} label="↷" sub="Redo" />
        </>
      );
    }
    if (activeTab === 'Ansicht') {
      return (
        <>
          <ToolBtn onClick={() => {}} label="100%" sub="Zoom" />
          <ToolBtn onClick={() => {}} label="📄" sub="Líneas" />
          <ToolBtn onClick={clearNote} label="⌫" sub="Clear" />
        </>
      );
    }
    if (activeTab === 'Einfügen') {
      return (
        <>
          <ToolBtn onClick={() => insertSnippet('Texto nuevo')} label="📝" sub="Text" />
          <ToolBtn onClick={() => insertSnippet('__TABLE__')} label="▦" sub="Tabelle" />
          <ToolBtn onClick={() => insertSnippet('__IMAGE__')} label="🖼" sub="Bild" />
          <ToolBtn onClick={() => insertSnippet('__CODE__')} label="</>" sub="Code" />
          <ToolBtn onClick={() => insertSnippet('__DIVIDER__')} label="—" sub="Linie" />
        </>
      );
    }
    return (
      <>
        <ToolBtn onClick={() => runCmd('bold')} label="B" sub="Negrita" />
        <ToolBtn onClick={() => runCmd('italic')} label="I" sub="Cursiva" />
        <ToolBtn onClick={() => runCmd('underline')} label="U" sub="Subrayar" />
        <ToolBtn onClick={() => runCmd('insertUnorderedList')} label="•" sub="Lista" />
        <ToolBtn onClick={() => runCmd('formatBlock', 'h2')} label="H1" sub="Título" />
        <ToolBtn onClick={() => insertSnippet('__TODO__')} label="☑" sub="Tarea" />
        <ToolBtn onClick={() => insertSnippet('__TABLE__')} label="▦" sub="Tabelle" />
        <ToolBtn onClick={() => insertSnippet('__CODE__')} label="</>" sub="Code" />
        <ToolBtn onClick={() => insertSnippet('__IMAGE__')} label="🖼" sub="Bild" />
        <ToolBtn onClick={() => insertSnippet('__DIVIDER__')} label="—" sub="Linie" />
        <ToolBtn onClick={undo} label="↶" sub="Undo" />
        <ToolBtn onClick={redo} label="↷" sub="Redo" />
      </>
    );
  };

  const startResize = (col) => (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startNotebook = notebookColWidth;
    const startPages = pagesColWidth;
    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      if (col === 'notebook') {
        const next = Math.max(180, Math.min(420, startNotebook + delta));
        setNotebookCollapsed(false);
        setNotebookColWidth(next);
      } else {
        const next = Math.max(220, Math.min(520, startPages + delta));
        setPagesCollapsed(false);
        setPagesColWidth(next);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onCreateNotebook = async () => {
    const name = window.prompt('Nombre del nuevo notebook:', '');
    if (name === null) return;
    await createNotebookQuick(name);
  };

  const onCreatePage = async () => {
    const name = window.prompt('Nombre de la nueva página:', '');
    if (name === null) return;
    await createPageQuick(null, name);
  };

  const onCreateSection = async () => {
    const name = window.prompt('Nombre de la nueva sección:', '');
    if (name === null) return;
    await createSectionQuick(nbId, name);
  };

  const onRenameNotebook = async () => {
    if (!nbId) return;
    const current = notebooks.find((n) => n.id === nbId);
    const name = window.prompt('Renombrar notebook:', current?.title || '');
    if (name === null) return;
    await renameNotebook(nbId, name);
  };

  const onRenameSection = async (section) => {
    const name = window.prompt('Renombrar sección:', section?.title || '');
    if (name === null) return;
    await renameSection(section.id, name);
  };

  const onRenamePage = async (page) => {
    const name = window.prompt('Renombrar página:', page?.title || '');
    if (name === null) return;
    await renamePage(page.id, name);
  };

  return (
    <div style={{ height: '100%', minHeight: 0, width: '100%', display: 'flex', background: '#fff' }}>
      <aside style={{ width: 48, borderRight: '1px solid #d8d8de', background: '#efeff2', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 10 }}>
        <RailBtn label="📘" />
        <RailBtn label="🔍" />
        <RailBtn label="⏱" />
      </aside>

      <aside style={{ width: notebookCollapsed ? 0 : notebookColWidth, borderRight: notebookCollapsed ? 'none' : '1px solid #d8d8de', background: '#f3f3f5', minHeight: 0, overflow: 'hidden', transition: 'width .15s ease' }}>
        <div style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Notebook</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onCreateNotebook} style={miniBtnStyle}>＋</button>
            <button onClick={() => setNotebookCollapsed(true)} style={miniBtnStyle}>—</button>
          </div>
        </div>
        <div style={{ overflow: 'auto', height: 'calc(100% - 40px)' }}>
        <div style={{ padding: '6px 10px' }}>
          <select
            value={nbId || ''}
            onChange={(e) => {
              const nextId = Number(e.target.value);
              if (Number.isFinite(nextId)) openNotebookEditor(nextId);
            }}
            onDoubleClick={onRenameNotebook}
            style={{ width: '100%', border: '1px solid #d3d3da', borderRadius: 6, padding: '6px 8px', fontSize: 13 }}
          >
            {notebooks.map((nb) => (
              <option key={nb.id} value={nb.id}>{nb.title}</option>
            ))}
          </select>
          <button onClick={onCreateSection} style={{ ...miniBtnStyle, width: '100%', marginTop: 6 }}>＋ Añadir sección</button>
        </div>
        {sectionList.map((sec) => (
          <button
            key={sec.id}
            onClick={() => openSectionEditor(sec.id)}
            style={{ width: '100%', textAlign: 'left', border: 'none', background: effectiveSectionId === sec.id ? '#e8e8ed' : 'transparent', padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onRenameSection(sec);
            }}
          >
            <div style={{ fontWeight: 600 }}>{sec.title}</div>
          </button>
        ))}
        </div>
      </aside>
      <ResizeHandle
        onMouseDown={startResize('notebook')}
        onDoubleClick={() => {
          setNotebookCollapsed(false);
          setNotebookColWidth(230);
        }}
      />

      <aside style={{ width: pagesCollapsed ? 0 : pagesColWidth, borderRight: pagesCollapsed ? 'none' : '1px solid #d8d8de', background: '#fafafa', minHeight: 0, overflow: 'hidden', transition: 'width .15s ease' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e5e5', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Páginas{sectionList[0] ? ` · ${sectionList.find((s) => s.id === effectiveSectionId)?.title || sectionList[0].title}` : ''}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onCreatePage} style={miniBtnStyle}>＋</button>
            <button onClick={() => setPagesCollapsed(true)} style={miniBtnStyle}>—</button>
          </div>
        </div>
        <div style={{ overflow: 'auto', height: 'calc(100% - 42px)' }}>
        {visiblePages.map((p) => (
          <button
            key={p.id}
            onClick={() => { if (effectiveSectionId) setActiveSectionId(effectiveSectionId); setActivePageId(p.id); }}
            style={{ width: '100%', border: 'none', borderBottom: '1px solid #ececef', background: activePageId === p.id ? '#ece8f7' : 'transparent', textAlign: 'left', padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onRenamePage(p);
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
            <div style={{ fontSize: 12, color: '#666' }}>Kein zusätzlicher Text</div>
          </button>
        ))}
        </div>
      </aside>
      <ResizeHandle
        onMouseDown={startResize('pages')}
        onDoubleClick={() => {
          setPagesCollapsed(false);
          setPagesColWidth(300);
        }}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ height: 38, background: '#7719aa', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', fontSize: 17, fontWeight: 600, letterSpacing: 0.2 }}>
          <span>Cuaderno</span>
        </div>
        {(notebookCollapsed || pagesCollapsed) ? (
          <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', borderBottom: '1px solid #e5e5ea', background: '#fbfbfd' }}>
            {notebookCollapsed ? <button onClick={() => setNotebookCollapsed(false)} style={miniBtnStyle}>↔ Notebook</button> : null}
            {pagesCollapsed ? <button onClick={() => setPagesCollapsed(false)} style={miniBtnStyle}>↔ Páginas</button> : null}
          </div>
        ) : null}

        <div style={{ height: 38, borderBottom: '1px solid #d8d8de', background: '#f7f7f8', display: 'flex', alignItems: 'flex-end', gap: 16, padding: '0 14px' }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #7c2ac9' : '2px solid transparent',
                background: 'transparent',
                padding: '0 2px 7px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: activeTab === tab ? 700 : 600,
                color: '#2f2f35',
                fontSize: 14,
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <OneNoteRichEditor pageId={pageId} activeTab={activeTab} mode="docs" />
      </div>
    </div>
  );
}

const miniBtnStyle = {
  border: '1px solid #cfcfd4',
  background: '#fff',
  borderRadius: 4,
  padding: '2px 8px',
  cursor: 'pointer',
  fontSize: 12,
  color: '#333',
};

function ResizeHandle({ onMouseDown, onDoubleClick }) {
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      style={{
        width: 6,
        cursor: 'col-resize',
        background: 'transparent',
        borderRight: '1px solid #ececf1',
        borderLeft: '1px solid #ececf1',
      }}
      title="Arrastrar para redimensionar"
    />
  );
}

function RailBtn({ label }) {
  return (
    <button style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16 }}>
      {label}
    </button>
  );
}

function ToolBtn({ onClick, label, sub }) {
  return (
    <button
      onClick={onClick}
      style={{
        minWidth: 62,
        border: '1px solid #cfcfd4',
        background: '#fff',
        color: '#333',
        borderRadius: 4,
        padding: '6px 8px',
        fontSize: 15,
        lineHeight: 1.1,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <span>{label}</span>
      {sub ? <span style={{ fontSize: 10, color: '#666', marginTop: 3 }}>{sub}</span> : null}
    </button>
  );
}

function RibbonGroup({ title, children }) {
  return (
    <div style={{ border: '1px solid #dbdbe0', borderRadius: 4, background: '#f8f8fa', padding: '4px 6px 20px', position: 'relative', display: 'flex', gap: 6, alignItems: 'center' }}>
      {children}
      <div style={{ position: 'absolute', bottom: 3, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: '#666' }}>{title}</div>
    </div>
  );
}
