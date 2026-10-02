import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import {
  REFLECTION_CATEGORIES,
  buildReflectionSummary,
  categoryById,
  chooseNextReflectionQuestion,
  normalizeReflectionItem,
  normalizeReflectionMetadata,
  todayIsoDate,
} from '../lib/reflectionBoard';
import {
  createReflectionItem,
  deleteReflectionItem,
  downloadReflectionPdf,
  getReflectionBoard,
  likeReflectionItem,
  resetReflectionBoard,
  updateReflectionBoard,
  updateReflectionItem,
} from '../lib/api';

const EMPTY_METADATA = { subject: '', className: '', topic: '', date: todayIsoDate() };
const SUITCASE_PLAYBACK_DURATION = 2600;

function normalizeBoard(data) {
  return {
    ...data,
    metadata: normalizeReflectionMetadata(data?.metadata || EMPTY_METADATA),
    question: String(data?.question || ''),
    items: Array.isArray(data?.items) ? data.items.map(normalizeReflectionItem) : [],
  };
}

function categoryIcon(category) {
  return category === 'koffer' ? '🧳' : category === 'muellkorb' ? '🗑️' : '💡';
}

function SuitcaseScene({ playback = false }) {
  return (
    <div className={`lm-reflection-suitcase-scene${playback ? ' lm-reflection-suitcase-scene--playback' : ' lm-reflection-suitcase-scene--intro'}`} aria-hidden="true">
      <span className="lm-reflection-suitcase-handle" />
      <span className="lm-reflection-suitcase-lid" />
      <span className="lm-reflection-suitcase-base" />
      <span className="lm-reflection-suitcase-strap lm-reflection-suitcase-strap--left" />
      <span className="lm-reflection-suitcase-strap lm-reflection-suitcase-strap--right" />
      <span className="lm-reflection-suitcase-tag">LM</span>
      <span className="lm-reflection-suitcase-wheel lm-reflection-suitcase-wheel--left" />
      <span className="lm-reflection-suitcase-wheel lm-reflection-suitcase-wheel--right" />
    </div>
  );
}

function ReflectionCard({ item, presentationMode, pendingLike, onLike, onEdit, onDelete, onMove, onDragStart }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const otherCategories = REFLECTION_CATEGORIES.filter((category) => category.id !== item.category);
  const category = categoryById(item.category);

  return (
    <article
      className="lm-reflection-card"
      draggable={!presentationMode}
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragEnd={() => onDragStart(null, null)}
    >
      <div className="lm-reflection-card-topline">
        <span className="lm-reflection-card-category">{categoryIcon(item.category)} {category.label}</span>
        {!presentationMode && (
          <div className="lm-reflection-card-menu-wrap">
            <button
              type="button"
              className="lm-reflection-icon-button"
              aria-label={`Aktionen für: ${item.content}`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >⋯</button>
            {menuOpen && (
              <div className="lm-reflection-card-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(item); }}>Bearbeiten</button>
                {otherCategories.map((target) => (
                  <button type="button" role="menuitem" key={target.id} onClick={() => { setMenuOpen(false); onMove(item, target.id); }}>
                    Nach {target.label} verschieben
                  </button>
                ))}
                <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenuOpen(false); onDelete(item); }}>Löschen</button>
              </div>
            )}
          </div>
        )}
      </div>
      <p>{item.content}</p>
      <div className="lm-reflection-card-footer">
        <button type="button" className="lm-reflection-like" onClick={() => onLike(item)} disabled={pendingLike(item)} aria-label={`Aussage unterstützen, aktuell ${item.likes} Unterstützungen`}>
          <span aria-hidden="true">♥</span> {item.likes}
        </button>
        {!presentationMode && <span className="lm-reflection-drag-hint" aria-hidden="true">↕</span>}
      </div>
    </article>
  );
}

function ReflectionColumn({ category, items, presentationMode, draggedId, onAdd, onDrop, ...handlers }) {
  const isDropTarget = draggedId && draggedId !== null;
  const canTapToAdd = category.id === 'koffer' || category.id === 'muellkorb';
  const handleColumnClick = (event) => {
    if (presentationMode || !canTapToAdd || event.target.closest?.('button, a, input, textarea, select, [role="menu"], .lm-reflection-card')) return;
    onAdd(category.id);
  };

  return (
    <section
      className={`lm-reflection-column lm-reflection-column--${category.id}${isDropTarget ? ' is-drop-target' : ''}`}
      onDragOver={(event) => { if (!presentationMode) event.preventDefault(); }}
      onDrop={(event) => { event.preventDefault(); if (!presentationMode) onDrop(category.id); }}
      onClick={handleColumnClick}
      aria-labelledby={`reflection-column-${category.id}`}
    >
      <header className="lm-reflection-column-header">
        <div><span className="lm-reflection-column-icon" aria-hidden="true">{categoryIcon(category.id)}</span><div><h2 id={`reflection-column-${category.id}`}>{category.title}</h2><p>{category.description}</p></div></div>
        <span className="lm-reflection-count" aria-label={`${items.length} Beiträge`}>{items.length}</span>
      </header>
      {!presentationMode && <button type="button" className="lm-reflection-add" onClick={() => onAdd(category.id)}>＋ Beitrag</button>}
      <div className="lm-reflection-card-list">
        {items.length ? items.map((item) => <ReflectionCard key={item.id} item={item} presentationMode={presentationMode} {...handlers} />) : <p className="lm-reflection-empty">Noch keine Beiträge</p>}
      </div>
    </section>
  );
}

export default function ReflectionBoard({ onPresentationChange }) {
  const [board, setBoard] = useState(null);
  const [metadata, setMetadata] = useState(EMPTY_METADATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [newReflectionOpen, setNewReflectionOpen] = useState(false);
  const [preserveMetadata, setPreserveMetadata] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationStep, setPresentationStep] = useState(-1);
  const [presentationAnimating, setPresentationAnimating] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const boardRef = useRef(null);
  const presentationTimerRef = useRef(null);
  const [draggedId, setDraggedId] = useState(null);
  const [pendingLikes, setPendingLikes] = useState(() => new Set());
  const editorInputRef = useRef(null);
  const metadataTimerRef = useRef(null);
  const metadataReadyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const nextBoard = normalizeBoard(await getReflectionBoard());
      const nextMetadata = {
        ...EMPTY_METADATA,
        ...nextBoard.metadata,
        date: nextBoard.metadata.date || EMPTY_METADATA.date,
      };
      setBoard(nextBoard);
      setMetadata(nextMetadata);
      metadataReadyRef.current = true;
      if (!nextBoard.question) {
        const question = chooseNextReflectionQuestion();
        setBoard((current) => current ? { ...current, question } : current);
        updateReflectionBoard({ question }).catch(() => {});
      }
    } catch {
      setError('Die Reflexion konnte nicht geladen werden. Bitte versuche es erneut.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); return () => window.clearTimeout(metadataTimerRef.current); }, [load]);

  useEffect(() => {
    onPresentationChange?.(presentationMode);
  }, [onPresentationChange, presentationMode]);

  useEffect(() => () => onPresentationChange?.(false), [onPresentationChange]);

  useEffect(() => {
    const syncFullscreen = () => {
      if (!document.fullscreenElement) setPresentationMode(false);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    if (!presentationMode) return;
    setSummaryOpen(true);
    setEditor(null);
    setNewReflectionOpen(false);
    setPendingDelete(null);
    setError('');
  }, [presentationMode]);

  useEffect(() => () => window.clearTimeout(presentationTimerRef.current), []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!editor) return undefined;
    const timer = window.setTimeout(() => editorInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [editor]);

  useEffect(() => {
    if (!metadataReadyRef.current || !board) return undefined;
    window.clearTimeout(metadataTimerRef.current);
    metadataTimerRef.current = window.setTimeout(() => {
      updateReflectionBoard({ metadata }).then((next) => setBoard((current) => ({ ...normalizeBoard(next), question: current?.question || next.question }))).catch(() => {});
    }, 500);
    return () => window.clearTimeout(metadataTimerRef.current);
  }, [metadata, board?.id]);

  const saveItem = async (event) => {
    event?.preventDefault();
    const content = String(editor?.content || '').trim();
    if (!content) return;
    try {
      if (editor.id) {
        const item = normalizeReflectionItem(await updateReflectionItem(editor.id, { content, category: editor.category }));
        setBoard((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === item.id ? item : candidate) }));
      } else {
        const item = normalizeReflectionItem(await createReflectionItem({ content, category: editor.category }));
        setBoard((current) => ({ ...current, items: [...current.items, item] }));
      }
      setEditor(null);
    } catch { setError('Der Beitrag konnte nicht gespeichert werden.'); }
  };

  const moveItem = async (item, category) => {
    try {
      const updated = normalizeReflectionItem(await updateReflectionItem(item.id, { category }));
      setBoard((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === updated.id ? updated : candidate) }));
    } catch { setError('Der Beitrag konnte nicht verschoben werden.'); }
  };

  const likeItem = async (item) => {
    if (pendingLikes.has(item.id)) return;
    setPendingLikes((current) => new Set(current).add(item.id));
    try {
      const result = await likeReflectionItem(item.id);
      setBoard((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === item.id ? { ...candidate, likes: Number(result.likes) || candidate.likes } : candidate) }));
    } catch { setError('Die Unterstützung konnte nicht gespeichert werden.'); }
    finally { setPendingLikes((current) => { const next = new Set(current); next.delete(item.id); return next; }); }
  };

  const deleteItem = async () => {
    if (!pendingDelete) return;
    try {
      await deleteReflectionItem(pendingDelete.id);
      setBoard((current) => ({ ...current, items: current.items.filter((item) => item.id !== pendingDelete.id) }));
    } catch { setError('Der Beitrag konnte nicht gelöscht werden.'); }
    finally { setPendingDelete(null); }
  };

  const resetBoard = async () => {
    try {
      const next = normalizeBoard(await resetReflectionBoard({ preserveMetadata, metadata: preserveMetadata ? metadata : undefined }));
      const question = chooseNextReflectionQuestion();
      setBoard({ ...next, question });
      setMetadata({ ...EMPTY_METADATA, ...next.metadata });
      updateReflectionBoard({ question }).catch(() => {});
      setNewReflectionOpen(false);
      setSummaryOpen(false);
    } catch { setError('Die neue Reflexion konnte nicht gestartet werden.'); }
  };

  const randomizeQuestion = async () => {
    const question = chooseNextReflectionQuestion(board?.question);
    setBoard((current) => ({ ...current, question }));
    try { await updateReflectionBoard({ question }); } catch { setError('Die Frage konnte nicht gespeichert werden.'); }
  };

  const openPresentation = async () => {
    setSummaryOpen(true);
    setPresentationStep(-1);
    setPresentationAnimating(false);
    window.clearTimeout(presentationTimerRef.current);
    setPresentationMode(true);
    try {
      await boardRef.current?.requestFullscreen?.();
    } catch {
      // Fullscreen can be blocked by the browser; the distraction-free view still works.
    }
  };

  const exportPdf = async () => {
    try {
      const blob = await downloadReflectionPdf();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'koffer-oder-muellkorb.pdf'; link.click(); URL.revokeObjectURL(url);
    } catch { setError('Der PDF-Export konnte nicht erstellt werden.'); }
  };

  if (loading) return <main className="lm-reflection-board lm-reflection-state">Reflexion wird geladen …</main>;
  if (!board) return <main className="lm-reflection-board lm-reflection-state"><p>{error || 'Keine Reflexion verfügbar.'}</p><button type="button" className="lm-button lm-button-primary" onClick={load}>Erneut laden</button></main>;

  const summary = buildReflectionSummary(board.items);
  const presentationQueue = ['koffer', 'muellkorb'].flatMap((category) => summary.groups[category].map((item) => ({ ...item, category })));
  const presentationItem = presentationQueue[presentationStep];
  const presentationIsTrash = presentationItem?.category === 'muellkorb';
  const playPresentationStep = (nextStep) => {
    if (nextStep < 0 || nextStep >= presentationQueue.length || presentationAnimating) return;
    setPresentationStep(nextStep);
    if (!reducedMotion) {
      setPresentationAnimating(true);
      window.clearTimeout(presentationTimerRef.current);
      presentationTimerRef.current = window.setTimeout(() => setPresentationAnimating(false), presentationQueue[nextStep].category === 'muellkorb' ? 3850 : SUITCASE_PLAYBACK_DURATION);
    }
  };
  const restartPresentation = () => {
    if (presentationAnimating) return;
    setPresentationStep(-1);
  };
  const closeEditor = () => setEditor(null);
  const renderColumn = (category) => <ReflectionColumn
    key={category.id}
    category={category}
    items={summary.groups[category.id]}
    presentationMode={presentationMode}
    draggedId={draggedId}
    onAdd={(categoryId) => setEditor({ category: categoryId, content: '' })}
    onDrop={(categoryId) => {
      const item = board.items.find((candidate) => candidate.id === draggedId);
      if (item && item.category !== categoryId) moveItem(item, categoryId);
      setDraggedId(null);
    }}
    onDragStart={(event, itemId) => {
      if (event) {
        setDraggedId(itemId);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(itemId));
      } else setDraggedId(null);
    }}
    pendingLike={(item) => pendingLikes.has(item.id)}
    onLike={likeItem}
    onEdit={(item) => setEditor({ id: item.id, category: item.category, content: item.content })}
    onDelete={setPendingDelete}
    onMove={moveItem}
  />;

  return (
    <main className={`lm-reflection-board${presentationMode ? ' is-presentation' : ''}`}>
      <header className="lm-reflection-hero">
        <div><span className="lm-reflection-kicker">Unterrichtsreflexion</span><h1>Koffer oder Müllkorb?</h1><p>Was nehmen wir aus der heutigen Stunde mit?</p></div>
        {!presentationMode && <div className="lm-reflection-toolbar">
          <button type="button" className="lm-button lm-button-secondary" onClick={() => setSummaryOpen((open) => !open)}>{summaryOpen ? 'Tafel' : 'Zusammenfassung'}</button>
          <button type="button" className="lm-button lm-button-secondary" onClick={openPresentation}>Zusammenfassung präsentieren</button>
          <button type="button" className="lm-button lm-button-secondary" onClick={exportPdf}>PDF exportieren</button>
          <button type="button" className="lm-button lm-button-primary" onClick={() => setNewReflectionOpen(true)}>Neue Reflexion</button>
        </div>}
      </header>

      {!presentationMode && <section className="lm-reflection-meta" aria-label="Reflexions-Metadaten">
        {[
          ['subject', 'Fach'], ['className', 'Klasse'], ['topic', 'Thema'], ['date', 'Datum'],
        ].map(([key, label]) => <label key={key}>{label}<input type={key === 'date' ? 'date' : 'text'} value={metadata[key]} onChange={(event) => setMetadata((current) => ({ ...current, [key]: event.target.value }))} placeholder={label} /></label>)}
      </section>}

      {!presentationMode && <section className="lm-reflection-question" aria-live="polite"><div><span>💬 Reflexionsfrage</span><strong>{board.question}</strong></div><button type="button" className="lm-button lm-button-secondary" onClick={randomizeQuestion}>Neue Frage</button></section>}

      {error && !presentationMode && <div className="lm-reflection-error" role="status">{error} <button type="button" onClick={() => setError('')}>Schließen</button></div>}

      {presentationMode ? <section className="lm-reflection-presentation" aria-label="Reflexionspräsentation">
        <div className="lm-reflection-presentation-stage" aria-live="polite">
          {presentationItem ? <article key={presentationItem.id} className={`lm-reflection-presentation-item lm-reflection-presentation-item--${presentationItem.category}${reducedMotion ? ' is-reduced-motion' : ''}`}>
            {presentationIsTrash ? <div className="lm-reflection-trash-scene"><p className="lm-reflection-presentation-sentence">{presentationItem.content}</p><span className="lm-reflection-trash-lid" aria-hidden="true">▰</span><span className="lm-reflection-trash-bin" aria-hidden="true">🗑️</span><span className="lm-reflection-trash-pop" aria-hidden="true">✦<i>★</i><b>✦</b></span></div> : <><p className="lm-reflection-presentation-sentence lm-reflection-presentation-sentence--suitcase">{presentationItem.content}</p><SuitcaseScene playback /></>}
          </article> : <div className="lm-reflection-presentation-intro">
            <div className="lm-reflection-presentation-intro-destinations" aria-hidden="true">
              <SuitcaseScene />
              <div className="lm-reflection-trash-scene"><span className="lm-reflection-trash-lid">▰</span><span className="lm-reflection-trash-bin">🗑️</span></div>
            </div>
            <p>Was nehme ich aus der heutigen Stunde mit?</p>
            <p>Was lasse ich hier?</p>
          </div>}
        </div>
        <nav className="lm-reflection-presentation-controls" aria-label="Präsentationssteuerung">
          <button type="button" className="lm-button lm-button-secondary" onClick={() => playPresentationStep(presentationStep - 1)} disabled={presentationAnimating || presentationStep < 0}>Zurück</button>
          <button type="button" className="lm-button lm-button-secondary" onClick={restartPresentation} disabled={presentationAnimating || presentationStep < 0}>Neu starten</button>
          <button type="button" className="lm-button lm-button-primary" onClick={() => playPresentationStep(presentationStep + 1)} disabled={presentationAnimating || presentationStep >= presentationQueue.length - 1 || !presentationQueue.length}>{presentationStep < 0 ? 'Start' : 'Weiter'}</button>
        </nav>
      </section> : summaryOpen ? <section className="lm-reflection-summary" aria-label="Reflexionszusammenfassung">
        <div className="lm-reflection-summary-heading"><div><span className="lm-reflection-kicker">Abschluss</span><h2>Das nehmen wir mit</h2></div><strong>{summary.total} Beiträge</strong></div>
        <div className="lm-reflection-summary-groups">{REFLECTION_CATEGORIES.map((category) => <section key={category.id}><h3>{categoryIcon(category.id)} {category.title}</h3>{summary.groups[category.id].length ? <ul>{summary.groups[category.id].map((item) => <li key={item.id}>{item.content} <span>♥ {item.likes}</span></li>)}</ul> : <p>Noch keine Beiträge</p>}</section>)}</div>
        <section className="lm-reflection-supported"><h3>Am meisten unterstützt</h3>{summary.mostSupported.length ? <ol>{summary.mostSupported.map((item) => <li key={item.id}><span>{item.content}</span><strong>♥ {item.likes}</strong></li>)}</ol> : <p>Noch keine Unterstützungen.</p>}</section>
      </section> : <section className="lm-reflection-columns">{REFLECTION_CATEGORIES.map(renderColumn)}</section>}

      {!presentationMode && <p className="lm-reflection-footnote">Beiträge bleiben in deiner geschützten Lehrermaps-Arbeitsumgebung. PNG-Export ist bewusst nicht enthalten, weil dafür keine neue Abhängigkeit ergänzt wird.</p>}

      {editor && <div className="lm-dialog-backdrop lm-reflection-editor-backdrop" onClick={closeEditor}><form className="lm-reflection-editor lm-modal-surface" role="dialog" aria-modal="true" aria-labelledby="reflection-editor-title" onClick={(event) => event.stopPropagation()} onSubmit={saveItem} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeEditor(); } if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); saveItem(event); } }}><div className="lm-reflection-editor-heading"><div><span className="lm-reflection-kicker">Beitrag</span><h2 id="reflection-editor-title">{editor.id ? 'Beitrag bearbeiten' : 'Gedanken festhalten'}</h2></div><button type="button" className="lm-reflection-icon-button" onClick={closeEditor} aria-label="Dialog schließen">×</button></div><textarea ref={editorInputRef} value={editor.content} onChange={(event) => setEditor((current) => ({ ...current, content: event.target.value }))} placeholder="Was möchtest du festhalten?" maxLength={2000} rows={4} aria-label="Beitrag" /><div className="lm-reflection-editor-categories" role="group" aria-label="Kategorie">{REFLECTION_CATEGORIES.map((category) => <button key={category.id} type="button" className={editor.category === category.id ? 'is-active' : ''} onClick={() => setEditor((current) => ({ ...current, category: category.id }))}>{categoryIcon(category.id)} {category.label}</button>)}</div><div className="lm-reflection-editor-actions"><span>Enter speichert · Shift+Enter macht eine neue Zeile · Escape schließt</span><button type="button" className="lm-button lm-button-secondary" onClick={closeEditor}>Abbrechen</button><button type="submit" className="lm-button lm-button-primary" disabled={!editor.content.trim()}>Hinzufügen</button></div></form></div>}

      {newReflectionOpen && <div className="lm-dialog-backdrop" onClick={() => setNewReflectionOpen(false)}><div className="lm-reflection-reset-dialog lm-modal-surface" role="dialog" aria-modal="true" aria-labelledby="reflection-reset-title" onClick={(event) => event.stopPropagation()}><h2 id="reflection-reset-title">Neue Reflexion starten?</h2><p>Alle Beiträge und Unterstützungen der aktuellen Reflexion werden gelöscht. Dieser Schritt kann nicht rückgängig gemacht werden.</p><label className="lm-reflection-check"><input type="checkbox" checked={preserveMetadata} onChange={(event) => setPreserveMetadata(event.target.checked)} /> Fach, Klasse, Thema und Datum übernehmen</label><div className="lm-reflection-editor-actions"><button type="button" className="lm-button lm-button-secondary" onClick={() => setNewReflectionOpen(false)}>Abbrechen</button><button type="button" className="lm-button lm-button-primary" onClick={resetBoard}>Neue Reflexion</button></div></div></div>}
      <ConfirmModal open={Boolean(pendingDelete)} title="Beitrag löschen?" message="Der Beitrag und seine Unterstützungen werden dauerhaft gelöscht." onClose={() => setPendingDelete(null)} onConfirm={deleteItem} />
    </main>
  );
}
