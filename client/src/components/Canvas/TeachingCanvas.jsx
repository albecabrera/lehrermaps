import { useEffect, useRef, useState } from 'react';
import { createLessonCanvasElement, deleteLessonCanvasElement, getLessonCanvas, setLessonCanvasVisibility, updateLessonCanvasElement } from '../../lib/api';

const VISIBILITY = { private: 'Privat', ready: 'Vorbereitet', displayed: 'Anzeigen', solution: 'Lösung' };
const colors = ['#172033', '#2563EB', '#DC2626', '#16A34A', '#D97706'];

export default function TeachingCanvas({ sessionId, phase, files = [], accent }) {
  const [canvas, setCanvas] = useState(null);
  const [tool, setTool] = useState('select');
  const [selected, setSelected] = useState(null);
  const [color, setColor] = useState(colors[0]);
  const [loading, setLoading] = useState(true);
  const surfaceRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const dragPositionRef = useRef(null);
  const [draftStroke, setDraftStroke] = useState([]);
  const [draftShape, setDraftShape] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [viewport, setViewport] = useState(() => { try { return JSON.parse(localStorage.getItem(`lm-teaching-viewport:${sessionId}:${phase?.id}`)) || { x: 0, y: 0, scale: 1 }; } catch { return { x: 0, y: 0, scale: 1 }; } });
  const [panning, setPanning] = useState(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const panRef = useRef(null);

  useEffect(() => { let cancelled = false; setLoading(true); getLessonCanvas(sessionId, phase?.id).then((value) => { if (!cancelled) setCanvas(value); }).catch(() => { if (!cancelled) setCanvas(null); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [sessionId, phase?.id]);
  useEffect(() => { try { localStorage.setItem(`lm-teaching-viewport:${sessionId}:${phase?.id}`, JSON.stringify(viewport)); } catch {} }, [sessionId, phase?.id, viewport]);
  useEffect(() => { const down = (event) => { const tag = event.target?.tagName?.toLowerCase(); const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || event.target?.isContentEditable; if (event.code === 'Space' && !typing && !event.repeat) { event.preventDefault(); setSpacePressed(true); } if (!typing && (event.key === 'Delete' || event.key === 'Backspace') && selected) remove(selected); if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey) { const shortcuts = { a: 'arrow', c: 'circle', r: 'rectangle', t: 'text', v: 'select', h: 'hand', p: 'pen', e: 'eraser' }; if (shortcuts[event.key.toLowerCase()]) { event.preventDefault(); setTool(shortcuts[event.key.toLowerCase()]); } if (event.key === 'Escape') { setTool('select'); setSelected(null); setEditingId(null); } } }; const up = (event) => { if (event.code === 'Space') setSpacePressed(false); }; window.addEventListener('keydown', down); window.addEventListener('keyup', up); return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); }; }, [selected]);
  const add = async (type, content = {}) => { const position = { x: 8 + ((canvas?.elements?.length || 0) * 3) % 70, y: 12 + ((canvas?.elements?.length || 0) * 4) % 60, w: 18, h: 8 }; return addAt(type, position, content); };
  const addAt = async (type, position, content = {}) => {
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const localElement = { id: localId, type, content, position, style: { color, background: type === 'text' ? '#fff' : `${color}18`, borderColor: color }, visibility: type === 'solution' ? 'solution' : 'private' };
    setCanvas((current) => ({ ...current, elements: [...(current?.elements || []), localElement] })); setSelected(localId); if (type === 'text') setEditingId(localId);
    try { const element = await createLessonCanvasElement(sessionId, phase.id, { type, content, position, style: localElement.style, visibility: localElement.visibility }); setCanvas((current) => ({ ...current, elements: current.elements.map((item) => item.id === localId ? element : item) })); setSelected(element.id); if (type === 'text') setEditingId(element.id); } catch { /* Das lokale Element bleibt sichtbar; ein späterer Reload zeigt den Serverfehler. */ }
  };
  const changeVisibility = async (id, visibility) => { await setLessonCanvasVisibility(id, visibility); setCanvas((current) => ({ ...current, elements: current.elements.map((item) => item.id === id ? { ...item, visibility } : item) })); };
  const update = async (element, content) => { setCanvas((current) => ({ ...current, elements: current.elements.map((item) => item.id === element.id ? { ...item, content } : item) })); await updateLessonCanvasElement(element.id, { content }).catch(() => {}); };
  const remove = async (id) => { setCanvas((current) => ({ ...current, elements: current.elements.filter((item) => item.id !== id) })); setSelected(null); setEditingId(null); if (!String(id).startsWith('local-')) await deleteLessonCanvasElement(id).catch(() => {}); };
  const pointFromEvent = (event) => { const rect = surfaceRef.current.getBoundingClientRect(); return { x: Math.max(-200, Math.min(300, (((event.clientX - rect.left) - viewport.x) / viewport.scale / rect.width) * 100)), y: Math.max(-200, Math.min(300, (((event.clientY - rect.top) - viewport.y) / viewport.scale / rect.height) * 100)) }; };
  const onSurfacePointerDown = (event) => {
    if (tool === 'hand' || spacePressed || event.button === 1) { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); panRef.current = { startX: event.clientX, startY: event.clientY, originX: viewport.x, originY: viewport.y }; setPanning({ pointerId: event.pointerId }); return; }
    if (tool === 'select') { setSelected(null); return; }
    if (tool === 'eraser') { return; }
    const point = pointFromEvent(event);
    if (tool === 'text') { event.preventDefault(); addAt('text', { x: point.x, y: point.y, w: 18, h: 8 }, { text: '' }); return; }
    if (['rectangle', 'circle', 'arrow', 'marker'].includes(tool)) { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDraftShape({ type: tool, start: point, current: point }); return; }
    if (tool !== 'pen') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraftStroke([pointFromEvent(event)]);
  };
  const onSurfacePointerMove = (event) => { if (panning && panRef.current) { setViewport((value) => ({ ...value, x: panRef.current.originX + event.clientX - panRef.current.startX, y: panRef.current.originY + event.clientY - panRef.current.startY })); return; } if (draftShape) { setDraftShape((value) => ({ ...value, current: pointFromEvent(event) })); return; } if (tool === 'pen' && draftStroke.length) setDraftStroke((points) => [...points, pointFromEvent(event)]); };
  const onSurfacePointerUp = async () => {
    if (panning) { setPanning(null); panRef.current = null; return; }
    if (draftShape) { const { type, start, current } = draftShape; const position = { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y), w: Math.max(4, Math.abs(current.x - start.x)), h: Math.max(4, Math.abs(current.y - start.y)) }; setDraftShape(null); if (type === 'arrow') position.h = Math.max(4, Math.abs(current.y - start.y)); await addAt(type, position, { text: type === 'arrow' ? '' : type === 'marker' ? 'Markierung' : '' }); return; }
    if (tool !== 'pen' || draftStroke.length < 2) { setDraftStroke([]); return; }
    const element = await createLessonCanvasElement(sessionId, phase.id, { type: 'ink', content: { points: draftStroke }, position: { x: 0, y: 0 }, style: { color, strokeWidth: 3 }, visibility: 'private', is_live_annotation: true });
    setCanvas((current) => ({ ...current, elements: [...(current?.elements || []), element] })); setDraftStroke([]); setSelected(element.id);
  };
  const zoomAt = (event, nextScale) => { const rect = surfaceRef.current.getBoundingClientRect(); const scale = Math.max(.35, Math.min(2.5, nextScale)); const cursorX = event ? event.clientX - rect.left : rect.width / 2; const cursorY = event ? event.clientY - rect.top : rect.height / 2; const worldX = (cursorX - viewport.x) / viewport.scale; const worldY = (cursorY - viewport.y) / viewport.scale; setViewport({ scale, x: cursorX - worldX * scale, y: cursorY - worldY * scale }); };
  const onWheel = (event) => { event.preventDefault(); zoomAt(event, viewport.scale * (event.deltaY < 0 ? 1.08 : .92)); };
  const onElementPointerDown = (event, element) => {
    if (tool === 'eraser') { event.stopPropagation(); remove(element.id); return; }
    if (tool !== 'select') return;
    event.stopPropagation();
    const point = pointFromEvent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(element.id);
    setDragging({ id: element.id, offsetX: point.x - Number(element.position?.x || 0), offsetY: point.y - Number(element.position?.y || 0) });
  };
  const onElementPointerMove = (event) => {
    if (!dragging) return;
    const point = pointFromEvent(event);
    const position = { x: Math.max(0, Math.min(94, point.x - dragging.offsetX)), y: Math.max(0, Math.min(94, point.y - dragging.offsetY)) };
    dragPositionRef.current = position;
    setCanvas((current) => ({ ...current, elements: current.elements.map((item) => item.id === dragging.id ? { ...item, position } : item) }));
  };
  const onElementPointerUp = async () => {
    if (!dragging) return;
    const element = canvas?.elements?.find((item) => item.id === dragging.id);
    if (element) await updateLessonCanvasElement(element.id, { position: dragPositionRef.current || element.position });
    dragPositionRef.current = null;
    setDragging(null);
  };
  if (loading) return <section className="lm-teaching-canvas"><span>Leinwand wird geladen …</span></section>;
  return <section className="lm-teaching-canvas" aria-label="Visuelle Phasen-Leinwand">
    <div className="lm-canvas-toolbar">
      <strong>Phasen-Leinwand</strong>
      <button onClick={() => setTool('select')} style={{ borderColor: tool === 'select' ? accent : undefined }}>Auswahl <kbd>V</kbd></button><button onClick={() => setTool('hand')} style={{ borderColor: tool === 'hand' ? accent : undefined }}>Hand <kbd>H</kbd></button><button onClick={() => setTool('pen')} style={{ borderColor: tool === 'pen' ? accent : undefined }}>Freihand <kbd>P</kbd></button><button onClick={() => setTool('eraser')} style={{ borderColor: tool === 'eraser' ? accent : undefined }}>Radierer <kbd>E</kbd></button>
      {['text', 'marker', 'circle', 'rectangle', 'arrow', 'material', 'solution'].map((item) => <button key={item} onClick={() => { if (item === 'material') add(item, { title: files[0]?.original_name || 'Materialkarte' }); else setTool(item); }} style={{ borderColor: tool === item ? accent : undefined }}>{item === 'text' ? 'Text' : item === 'marker' ? 'Marker' : item === 'circle' ? 'Kreis' : item === 'rectangle' ? 'Rechteck' : item === 'arrow' ? 'Pfeil' : item === 'material' ? 'Material' : 'Lösung'} {item === 'arrow' && <kbd>A</kbd>}{item === 'circle' && <kbd>C</kbd>}{item === 'rectangle' && <kbd>R</kbd>}{item === 'text' && <kbd>T</kbd>}</button>)}
      <span className="lm-canvas-colors">{colors.map((value) => <button key={value} aria-label={`Farbe ${value}`} onClick={() => setColor(value)} style={{ background: value, outline: color === value ? `2px solid ${accent}` : 'none' }} />)}</span>
      <span className="lm-canvas-zoom"><button onClick={() => zoomAt(null, viewport.scale - .1)} aria-label="Herauszoomen">−</button><span>{Math.round(viewport.scale * 100)}%</span><button onClick={() => zoomAt(null, viewport.scale + .1)} aria-label="Hineinzoomen">+</button><button onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}>Zentrieren</button></span>
    </div>
    <div ref={surfaceRef} className={`lm-canvas-surface ${tool === 'pen' ? 'is-drawing' : ''} ${tool === 'hand' || spacePressed ? 'is-pannable' : ''}`} onWheel={onWheel} onPointerDown={onSurfacePointerDown} onPointerMove={onSurfacePointerMove} onPointerUp={onSurfacePointerUp} onPointerCancel={onSurfacePointerUp}>
      <div className="lm-canvas-world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
      <svg className="lm-canvas-ink-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{(canvas?.elements || []).filter((element) => element.type === 'ink').map((element) => <polyline key={element.id} onPointerDown={(event) => { if (tool === 'eraser') { event.stopPropagation(); remove(element.id); } }} className={tool === 'eraser' ? 'is-erasable' : ''} points={(element.content?.points || []).map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={element.style?.color || color} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />)}{draftStroke.length > 1 && <polyline points={draftStroke.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />}</svg>
      {(canvas?.elements || []).filter((element) => element.type !== 'ink').map((element) => { const isSelected = selected === element.id; const position = element.position || {}; const style = { left: `${position.x ?? 10}%`, top: `${position.y ?? 10}%`, width: position.w ? `${position.w}%` : undefined, height: position.h ? `${position.h}%` : undefined, color: element.style?.color || color, borderColor: element.style?.borderColor || color }; return <div key={element.id} onPointerDown={(event) => onElementPointerDown(event, element)} onPointerMove={onElementPointerMove} onPointerUp={onElementPointerUp} className={`lm-canvas-element lm-canvas-${element.type} ${isSelected ? 'is-selected' : ''}`} style={style}>
        {element.type === 'arrow' ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Pfeil"><line x1="5" y1="50" x2="88" y2="50" stroke="currentColor" strokeWidth="5"/><path d="M72 25 L95 50 L72 75" fill="none" stroke="currentColor" strokeWidth="5"/></svg> : editingId === element.id ? <input autoFocus value={element.content?.text || ''} onChange={(event) => update(element, { ...element.content, text: event.target.value })} onBlur={() => setEditingId(null)} onPointerDown={(event) => event.stopPropagation()} aria-label="Text auf der Leinwand" /> : <span onDoubleClick={() => element.type === 'text' && setEditingId(element.id)}>{element.content?.text || element.content?.title || (element.type === 'circle' ? 'Kreis' : element.type === 'rectangle' ? 'Rechteck' : element.type)}</span>}
        {isSelected && <div className="lm-canvas-element-actions" onPointerDown={(event) => event.stopPropagation()}><select value={element.visibility} onChange={(event) => changeVisibility(element.id, event.target.value)} aria-label="Sichtbarkeit">{Object.entries(VISIBILITY).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button onClick={() => remove(element.id)} aria-label="Element löschen">×</button></div>}
      </div>; })}
      {!canvas?.elements?.length && <div className="lm-canvas-empty">Füge Text, Markierungen oder Materialkarten für diese Phase hinzu.</div>}
      {draftShape && <div className={`lm-canvas-element lm-canvas-${draftShape.type} is-draft`} style={{ left: `${Math.min(draftShape.start.x, draftShape.current.x)}%`, top: `${Math.min(draftShape.start.y, draftShape.current.y)}%`, width: `${Math.max(4, Math.abs(draftShape.current.x - draftShape.start.x))}%`, height: `${Math.max(4, Math.abs(draftShape.current.y - draftShape.start.y))}%`, color, borderColor: color }}>{draftShape.type === 'arrow' ? '➜' : draftShape.type}</div>}
      </div>
    </div>
    {selected && <div className="lm-canvas-inspector">{(() => { const element = canvas.elements.find((item) => item.id === selected); return element ? <><strong>Element bearbeiten</strong><input value={element.content?.text || element.content?.title || ''} onChange={(event) => update(element, { ...element.content, text: event.target.value })} aria-label="Elementtext" /><span className="lm-canvas-shortcuts">A Pfeil · C Kreis · R Rechteck · T Text · V Auswahl · H Hand · P Stift · E Radierer · Entf Löschen</span></> : null; })()}</div>}
  </section>;
}
