import { useMemo, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNotebook } from '../../contexts/NotebookContext';

const COLORS = ['#3B82F6', '#8B5CF6', '#14B8A6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#64748B'];

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners}>{children}</div>;
}

export default function NotebookSidebar() {
  const {
    notebooks, sectionsByNotebook, pagesBySection,
    activeNotebookId, activeSectionId, activePageId,
    setActiveNotebookId, setActiveSectionId, setActivePageId,
    setNotebookColor, setSectionColor,
    reorderNotebooks, reorderSections, reorderPages,
    openNotebookEditor, openSectionEditor,
    loading,
  } = useNotebook();

  const [openNotebooks, setOpenNotebooks] = useState({});
  const [openSections, setOpenSections] = useState({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const notebookIds = useMemo(() => notebooks.map((n) => `n-${n.id}`), [notebooks]);

  if (loading) {
    return <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--c-text-3)' }}>Cargando…</div>;
  }

  const handleNotebookDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = notebookIds.indexOf(active.id);
    const newIndex = notebookIds.indexOf(over.id);
    const moved = arrayMove(notebooks, oldIndex, newIndex).map((n) => n.id);
    await reorderNotebooks(moved);
  };

  return (
    <div style={{ margin: '8px 10px 12px', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNotebookDragEnd}>
        <SortableContext items={notebookIds} strategy={verticalListSortingStrategy}>
          <div style={{ maxHeight: 260, overflow: 'auto' }}>
            {notebooks.map((nb) => {
              const nbOpen = openNotebooks[nb.id] ?? true;
              const sections = sectionsByNotebook[nb.id] || [];
              const sectionIds = sections.map((s) => `s-${s.id}`);
              return (
                <SortableItem key={nb.id} id={`n-${nb.id}`}>
                  <div style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <Row
                      label={nb.title}
                      level={0}
                      color={nb.color}
                      active={activeNotebookId === nb.id}
                      open={nbOpen}
                      onToggle={() => setOpenNotebooks((p) => ({ ...p, [nb.id]: !nbOpen }))}
                      onClick={async () => { await openNotebookEditor(nb.id); }}
                      onColor={(c) => setNotebookColor(nb.id, c)}
                    />

                    {nbOpen && (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={async ({ active, over }) => {
                          if (!over || active.id === over.id) return;
                          const oldIndex = sectionIds.indexOf(active.id);
                          const newIndex = sectionIds.indexOf(over.id);
                          const moved = arrayMove(sections, oldIndex, newIndex).map((s) => s.id);
                          await reorderSections(nb.id, moved);
                        }}
                      >
                        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                          {sections.map((section) => {
                            const secOpen = openSections[section.id] ?? true;
                            const pages = pagesBySection[section.id] || [];
                            const pageIds = pages.map((p) => `p-${p.id}`);
                            return (
                              <SortableItem key={section.id} id={`s-${section.id}`}>
                                <Row
                                  label={section.title}
                                  level={1}
                                  color={section.color}
                                  active={activeSectionId === section.id}
                                  open={secOpen}
                                  onToggle={() => setOpenSections((p) => ({ ...p, [section.id]: !secOpen }))}
                                  onClick={() => {
                                    setActiveNotebookId(nb.id);
                                    openSectionEditor(section.id);
                                  }}
                                  onColor={(c) => setSectionColor(section.id, c)}
                                />

                                {secOpen && (
                                  <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={async ({ active, over }) => {
                                      if (!over || active.id === over.id) return;
                                      const oldIndex = pageIds.indexOf(active.id);
                                      const newIndex = pageIds.indexOf(over.id);
                                      const moved = arrayMove(pages, oldIndex, newIndex).map((p) => p.id);
                                      await reorderPages(section.id, moved);
                                    }}
                                  >
                                    <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
                                      {pages.map((page) => (
                                        <SortableItem key={page.id} id={`p-${page.id}`}>
                                          <Row
                                            label={page.title}
                                            level={2}
                                            active={activePageId === page.id}
                                            onClick={() => {
                                              setActiveNotebookId(nb.id);
                                              setActiveSectionId(section.id);
                                              setActivePageId(page.id);
                                            }}
                                          />
                                        </SortableItem>
                                      ))}
                                    </SortableContext>
                                  </DndContext>
                                )}
                              </SortableItem>
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                </SortableItem>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Row({ label, level, color, active, open, onToggle, onClick, onColor }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: `6px 8px 6px ${8 + level * 14}px`,
        fontSize: 12,
        cursor: 'pointer',
        borderLeft: color ? `3px solid ${color}` : '3px solid transparent',
        background: active ? 'var(--c-hover-2)' : 'transparent',
      }}
    >
      {typeof open === 'boolean' ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          style={{ border: 'none', background: 'transparent', color: 'var(--c-text-3)', padding: 0, cursor: 'pointer' }}
        >
          {open ? '▾' : '▸'}
        </button>
      ) : <span style={{ width: 10 }} />}

      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>

      {onColor && (
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          {COLORS.slice(0, 3).map((c) => (
            <button
              key={c}
              title="color"
              onClick={() => onColor(c)}
              style={{ width: 10, height: 10, borderRadius: 999, border: 'none', background: c, cursor: 'pointer' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
