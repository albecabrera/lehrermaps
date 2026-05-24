import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getNotebooks, createNotebook, patchNotebook,
  getSections, createSection, patchSection,
  getPages, createPage, patchPage,
  saveBlocks,
} from '../lib/api';

const NotebookContext = createContext(null);

export function NotebookProvider({ children }) {
  const [notebooks, setNotebooks] = useState([]);
  const [sectionsByNotebook, setSectionsByNotebook] = useState({});
  const [pagesBySection, setPagesBySection] = useState({});
  const [loading, setLoading] = useState(true);

  const [activeNotebookId, setActiveNotebookId] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [activePageId, setActivePageId] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const nb = await getNotebooks();
      setNotebooks(nb);

      const sectionPairs = await Promise.all(nb.map(async (n) => [n.id, await getSections(n.id)]));
      const nextSections = Object.fromEntries(sectionPairs);
      setSectionsByNotebook(nextSections);

      const allSections = sectionPairs.flatMap(([, s]) => s);
      const pagePairs = await Promise.all(allSections.map(async (s) => [s.id, await getPages(s.id)]));
      setPagesBySection(Object.fromEntries(pagePairs));

      if (!activeNotebookId && nb[0]) setActiveNotebookId(nb[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload().catch(() => setLoading(false));
  }, []);

  const ensureNotebook = async () => {
    if (notebooks.length) return notebooks[0];
    const created = await createNotebook({ title: 'Notebook' });
    setNotebooks((prev) => [...prev, created]);
    setSectionsByNotebook((prev) => ({ ...prev, [created.id]: [] }));
    return created;
  };

  const addSectionAndPageIfMissing = async () => {
    const notebook = await ensureNotebook();
    let sections = sectionsByNotebook[notebook.id] || [];
    if (!sections.length) {
      const sec = await createSection({ notebook_id: notebook.id, title: 'Unterrichtsreihe' });
      sections = [sec];
      setSectionsByNotebook((prev) => ({ ...prev, [notebook.id]: sections }));
    }
    const section = sections[0];
    const pages = pagesBySection[section.id] || [];
    if (!pages.length) {
      const page = await createPage({ section_id: section.id, title: 'Seite 1' });
      setPagesBySection((prev) => ({ ...prev, [section.id]: [page] }));
    }
  };

  const reorderNotebooks = async (orderedIds) => {
    const next = orderedIds.map((id, idx) => ({ id, position: idx }));
    await Promise.all(next.map((n) => patchNotebook(n.id, { position: n.position })));
    setNotebooks((prev) => [...prev].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)));
  };

  const reorderSections = async (notebookId, orderedIds) => {
    await Promise.all(orderedIds.map((id, idx) => patchSection(id, { position: idx })));
    setSectionsByNotebook((prev) => ({
      ...prev,
      [notebookId]: [...(prev[notebookId] || [])].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)),
    }));
  };

  const reorderPages = async (sectionId, orderedIds) => {
    await Promise.all(orderedIds.map((id, idx) => patchPage(id, { position: idx })));
    setPagesBySection((prev) => ({
      ...prev,
      [sectionId]: [...(prev[sectionId] || [])].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)),
    }));
  };

  const templateBlocks = (templateId) => {
    const base = (x, y, text, type = 'text', content = null) => ({
      type,
      content: content || { text },
      pos_x: x,
      pos_y: y,
      width: 520,
      z_index: 1,
    });
    if (templateId === 'lesson') return [
      base(90, 70, 'Stundenziel'),
      base(90, 210, 'Ablauf'),
      base(90, 350, 'Materialien'),
    ];
    if (templateId === 'parent') return [
      base(90, 70, 'Anliegen'),
      base(90, 210, 'Beobachtungen'),
      base(90, 350, 'Vereinbarungen'),
    ];
    if (templateId === 'classnote') return [
      base(90, 70, 'Thema'),
      base(90, 210, 'Notizen'),
      base(90, 350, 'Nächste Schritte'),
    ];
    return [base(90, 80, '')];
  };

  const createPageFromTemplate = async ({ sectionId, title, templateId }) => {
    let resolvedSectionId = sectionId;
    let resolvedNotebookId = activeNotebookId || notebooks[0]?.id || null;

    if (!resolvedSectionId) {
      const candidateSections = resolvedNotebookId ? (sectionsByNotebook[resolvedNotebookId] || []) : [];
      if (candidateSections.length) {
        resolvedSectionId = candidateSections[0].id;
      } else {
        const nb = resolvedNotebookId
          ? notebooks.find((n) => n.id === resolvedNotebookId)
          : await ensureNotebook();
        resolvedNotebookId = nb?.id || resolvedNotebookId;
        const sec = await createSection({ notebook_id: resolvedNotebookId, title: 'Unterrichtsreihe' });
        setSectionsByNotebook((prev) => ({ ...prev, [resolvedNotebookId]: [...(prev[resolvedNotebookId] || []), sec] }));
        resolvedSectionId = sec.id;
      }
    }

    const page = await createPage({ section_id: resolvedSectionId, title, template_id: templateId });
    setPagesBySection((prev) => ({ ...prev, [resolvedSectionId]: [...(prev[resolvedSectionId] || []), page] }));
    await saveBlocks(page.id, templateBlocks(templateId));
    if (resolvedNotebookId) setActiveNotebookId(resolvedNotebookId);
    setActiveSectionId(resolvedSectionId);
    setActivePageId(page.id);
    return page;
  };

  const openSectionEditor = async (sectionId) => {
    if (!sectionId) return;
    let pages = pagesBySection[sectionId] || [];
    if (!pages.length) {
      const page = await createPage({ section_id: sectionId, title: 'Neue Seite', template_id: 'empty' });
      setPagesBySection((prev) => ({ ...prev, [sectionId]: [...(prev[sectionId] || []), page] }));
      await saveBlocks(page.id, templateBlocks('empty'));
      pages = [page];
    }
    setActiveSectionId(sectionId);
    setActivePageId(pages[0].id);
  };

  const openNotebookEditor = async (notebookId = null) => {
    let resolvedNotebookId = notebookId;
    if (!resolvedNotebookId) {
      const existing = notebooks[0];
      if (existing?.id) resolvedNotebookId = existing.id;
      else {
        const created = await createNotebook({ title: 'Notebook' });
        setNotebooks((prev) => [...prev, created]);
        setSectionsByNotebook((prev) => ({ ...prev, [created.id]: [] }));
        resolvedNotebookId = created.id;
      }
    }
    if (!resolvedNotebookId) return;
    let sections = sectionsByNotebook[resolvedNotebookId] || [];
    if (!sections.length) {
      const sec = await createSection({ notebook_id: resolvedNotebookId, title: 'Unterrichtsreihe' });
      setSectionsByNotebook((prev) => ({ ...prev, [resolvedNotebookId]: [...(prev[resolvedNotebookId] || []), sec] }));
      sections = [sec];
    }
    setActiveNotebookId(resolvedNotebookId);
    await openSectionEditor(sections[0].id);
  };

  const openOneNoteHome = async () => {
    // Abrir editor inmediatamente (modo local) para respuesta instantánea al clic
    setActivePageId('onenote_local');
    try {
      await openNotebookEditor(activeNotebookId || null);
    } catch {
      setActiveNotebookId(null);
      setActiveSectionId(null);
      setActivePageId('onenote_local');
    }
  };

  const createNotebookQuick = async (title = '') => {
    const position = notebooks.length;
    const finalTitle = (title || '').trim() || `Notebook ${position + 1}`;
    const created = await createNotebook({ title: finalTitle, position });
    setNotebooks((prev) => [...prev, created]);
    const sec = await createSection({ notebook_id: created.id, title: 'Unterrichtsreihe', position: 0 });
    setSectionsByNotebook((prev) => ({ ...prev, [created.id]: [sec] }));
    const page = await createPage({ section_id: sec.id, title: 'Seite 1', template_id: 'empty', position: 0 });
    setPagesBySection((prev) => ({ ...prev, [sec.id]: [page] }));
    setActiveNotebookId(created.id);
    setActiveSectionId(sec.id);
    setActivePageId(page.id);
    return created;
  };

  const createPageQuick = async (sectionId = null, title = '') => {
    let resolvedSectionId = sectionId || activeSectionId;
    let resolvedNotebookId = activeNotebookId;

    if (!resolvedSectionId) {
      if (!resolvedNotebookId) {
        const first = notebooks[0] || await createNotebookQuick();
        resolvedNotebookId = first.id;
      }
      const sections = sectionsByNotebook[resolvedNotebookId] || [];
      if (sections.length) resolvedSectionId = sections[0].id;
      else {
        const sec = await createSection({ notebook_id: resolvedNotebookId, title: 'Unterrichtsreihe', position: 0 });
        setSectionsByNotebook((prev) => ({ ...prev, [resolvedNotebookId]: [sec] }));
        resolvedSectionId = sec.id;
      }
    }

    const existing = pagesBySection[resolvedSectionId] || [];
    const finalTitle = (title || '').trim() || `Seite ${existing.length + 1}`;
    const created = await createPage({
      section_id: resolvedSectionId,
      title: finalTitle,
      template_id: 'empty',
      position: existing.length,
    });
    setPagesBySection((prev) => ({ ...prev, [resolvedSectionId]: [...(prev[resolvedSectionId] || []), created] }));
    setActiveSectionId(resolvedSectionId);
    setActivePageId(created.id);
    return created;
  };

  const createSectionQuick = async (notebookId = null, title = '') => {
    let resolvedNotebookId = notebookId || activeNotebookId || notebooks[0]?.id;
    if (!resolvedNotebookId) {
      const createdNb = await createNotebookQuick();
      resolvedNotebookId = createdNb.id;
    }
    const current = sectionsByNotebook[resolvedNotebookId] || [];
    const finalTitle = (title || '').trim() || `Abschnitt ${current.length + 1}`;
    const created = await createSection({
      notebook_id: resolvedNotebookId,
      title: finalTitle,
      position: current.length,
    });
    setSectionsByNotebook((prev) => ({
      ...prev,
      [resolvedNotebookId]: [...(prev[resolvedNotebookId] || []), created],
    }));
    setActiveNotebookId(resolvedNotebookId);
    setActiveSectionId(created.id);
    return created;
  };

  const sortEverything = async (mode = 'alpha') => {
    const notebookSorted = [...notebooks].sort((a, b) =>
      mode === 'alpha' ? a.title.localeCompare(b.title) : (a.id - b.id)
    );
    await reorderNotebooks(notebookSorted.map((n) => n.id));

    for (const nb of notebookSorted) {
      const sections = [...(sectionsByNotebook[nb.id] || [])].sort((a, b) =>
        mode === 'alpha' ? a.title.localeCompare(b.title) : (a.id - b.id)
      );
      await reorderSections(nb.id, sections.map((s) => s.id));
      for (const sec of sections) {
        const pages = [...(pagesBySection[sec.id] || [])].sort((a, b) =>
          mode === 'alpha' ? a.title.localeCompare(b.title) : (a.id - b.id)
        );
        await reorderPages(sec.id, pages.map((p) => p.id));
      }
    }
  };

  const renameNotebook = async (id, title) => {
    const nextTitle = (title || '').trim();
    if (!id || !nextTitle) return;
    await patchNotebook(id, { title: nextTitle });
    setNotebooks((prev) => prev.map((n) => (n.id === id ? { ...n, title: nextTitle } : n)));
  };

  const renameSection = async (id, title) => {
    const nextTitle = (title || '').trim();
    if (!id || !nextTitle) return;
    await patchSection(id, { title: nextTitle });
    setSectionsByNotebook((prev) => {
      const out = { ...prev };
      Object.keys(out).forEach((nbId) => {
        out[nbId] = (out[nbId] || []).map((s) => (s.id === id ? { ...s, title: nextTitle } : s));
      });
      return out;
    });
  };

  const renamePage = async (id, title) => {
    const nextTitle = (title || '').trim();
    if (!id || !nextTitle) return;
    await patchPage(id, { title: nextTitle });
    setPagesBySection((prev) => {
      const out = { ...prev };
      Object.keys(out).forEach((secId) => {
        out[secId] = (out[secId] || []).map((p) => (p.id === id ? { ...p, title: nextTitle } : p));
      });
      return out;
    });
  };

  const value = useMemo(() => ({
    notebooks,
    sectionsByNotebook,
    pagesBySection,
    loading,
    activeNotebookId,
    activeSectionId,
    activePageId,
    setActiveNotebookId,
    setActiveSectionId,
    setActivePageId,
    setNotebookColor: (id, color) => patchNotebook(id, { color }).then(reload),
    setSectionColor: (id, color) => patchSection(id, { color }).then(reload),
    reorderNotebooks,
    reorderSections,
    reorderPages,
    sortEverything,
    createPageFromTemplate,
    openNotebookEditor,
    openSectionEditor,
    openOneNoteHome,
    createNotebookQuick,
    createSectionQuick,
    createPageQuick,
    renameNotebook,
    renameSection,
    renamePage,
    reload,
    addSectionAndPageIfMissing,
  }), [notebooks, sectionsByNotebook, pagesBySection, loading, activeNotebookId, activeSectionId, activePageId]);

  return <NotebookContext.Provider value={value}>{children}</NotebookContext.Provider>;
}

export function useNotebook() {
  const ctx = useContext(NotebookContext);
  if (!ctx) throw new Error('useNotebook must be used inside NotebookProvider');
  return ctx;
}
