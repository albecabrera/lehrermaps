import { useState } from 'react';
import { useNotebook } from '../../contexts/NotebookContext';
import OneNoteRichEditor from './OneNoteRichEditor';

const TABS = ['Start', 'Einfügen', 'Zeichnen', 'Ansicht', 'Notizbuch'];

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
  const [notebookColWidth, setNotebookColWidth] = useState(230);
  const [pagesColWidth, setPagesColWidth] = useState(300);
  const [notebookCollapsed, setNotebookCollapsed] = useState(false);
  const [pagesCollapsed, setPagesCollapsed] = useState(false);

  const nbId = activeNotebookId || notebooks[0]?.id || null;
  const sectionList = nbId ? (sectionsByNotebook[nbId] || []) : [];
  const effectiveSectionId = (activeSectionId && sectionList.some((s) => s.id === activeSectionId))
    ? activeSectionId
    : (sectionList[0]?.id || null);
  const visiblePages = effectiveSectionId ? (pagesBySection[effectiveSectionId] || []) : [];

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
    const name = window.prompt('Name des neuen Notizbuchs:', '');
    if (name === null) return;
    await createNotebookQuick(name);
  };

  const onCreatePage = async () => {
    const name = window.prompt('Name der neuen Seite:', '');
    if (name === null) return;
    await createPageQuick(null, name);
  };

  const onCreateSection = async () => {
    const name = window.prompt('Name des neuen Abschnitts:', '');
    if (name === null) return;
    await createSectionQuick(nbId, name);
  };

  const onRenameNotebook = async () => {
    if (!nbId) return;
    const current = notebooks.find((n) => n.id === nbId);
    const name = window.prompt('Notizbuch umbenennen:', current?.title || '');
    if (name === null) return;
    await renameNotebook(nbId, name);
  };

  const onRenameSection = async (section) => {
    const name = window.prompt('Abschnitt umbenennen:', section?.title || '');
    if (name === null) return;
    await renameSection(section.id, name);
  };

  const onRenamePage = async (page) => {
    const name = window.prompt('Seite umbenennen:', page?.title || '');
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
          <span>Notizbuch</span>
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
          <button onClick={onCreateSection} style={{ ...miniBtnStyle, width: '100%', marginTop: 6 }}>＋ Abschnitt hinzufügen</button>
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
          <span>Seiten{sectionList[0] ? ` · ${sectionList.find((s) => s.id === effectiveSectionId)?.title || sectionList[0].title}` : ''}</span>
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
            <div style={{ fontSize: 12, color: '#666' }}>Kein weiterer Text</div>
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
          <span>Notizbuch</span>
        </div>
        {(notebookCollapsed || pagesCollapsed) ? (
          <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', borderBottom: '1px solid #e5e5ea', background: '#fbfbfd' }}>
            {notebookCollapsed ? <button onClick={() => setNotebookCollapsed(false)} style={miniBtnStyle}>↔ Notizbuch</button> : null}
            {pagesCollapsed ? <button onClick={() => setPagesCollapsed(false)} style={miniBtnStyle}>↔ Seiten</button> : null}
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
