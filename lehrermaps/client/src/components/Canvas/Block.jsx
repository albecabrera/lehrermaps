import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import TextBlock from './BlockTypes/TextBlock';
import SlashMenu from '../SlashMenu';

export default function Block({ block, onContentChange }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(block.id) });
  const [slashMenu, setSlashMenu] = useState({ open: false, x: 0, y: 0 });

  const style = {
    position: 'absolute',
    left: block.pos_x,
    top: block.pos_y,
    width: block.width || 420,
    zIndex: block.z_index || 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.85 : 1,
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    overflow: 'hidden',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...listeners}
        {...attributes}
        style={{
          height: 20,
          cursor: 'grab',
          borderBottom: '1px solid rgba(0,0,0,.04)',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 6px',
          fontSize: 10,
          color: '#9aa0a6',
          userSelect: 'none',
        }}
      >
        <span>{block.type}</span>
        <span style={{ fontSize: 10 }}>⋮⋮</span>
      </div>

      <div style={{ padding: 10 }}>
        {block.type === 'text' && (
          <TextBlock
            value={block.content?.text || ''}
            onChange={(text) => onContentChange(block.id, { ...block.content, text })}
            onSlashTrigger={({ x, y }) => setSlashMenu({ open: true, x, y })}
          />
        )}

        {block.type === 'todo' && (
          <TodoEditor
            items={block.content?.items || [{ text: '', done: false }]}
            onChange={(items) => onContentChange(block.id, { ...block.content, items })}
          />
        )}

        {block.type === 'table' && (
          <TableEditor
            rows={block.content?.rows || [['', ''], ['', '']]}
            onChange={(rows) => onContentChange(block.id, { ...block.content, rows })}
          />
        )}

        {block.type === 'code' && (
          <CodeEditor
            value={block.content?.text || ''}
            language={block.content?.language || 'txt'}
            onChange={(text) => onContentChange(block.id, { ...block.content, text })}
            onLanguage={(language) => onContentChange(block.id, { ...block.content, language })}
          />
        )}

        {block.type === 'image' && (
          <ImageEditor
            url={block.content?.url || ''}
            alt={block.content?.alt || ''}
            onChange={(next) => onContentChange(block.id, { ...block.content, ...next })}
          />
        )}

        {block.type === 'divider' && (
          <div style={{ padding: '10px 0 2px' }}>
            <hr style={{ border: 'none', borderTop: '1px solid var(--c-border)', margin: 0 }} />
          </div>
        )}
      </div>

      <SlashMenu
        open={slashMenu.open}
        x={slashMenu.x}
        y={slashMenu.y}
        onClose={() => setSlashMenu({ open: false, x: 0, y: 0 })}
        onSelect={(type) => {
          const payloadByType = {
            todo: { type: 'todo', content: { items: [{ text: '', done: false }] } },
            table: { type: 'table', content: { rows: [['', ''], ['', '']] } },
            code: { type: 'code', content: { text: '', language: 'txt' } },
            image: { type: 'image', content: { url: '', alt: '' } },
            divider: { type: 'divider', content: {} },
            heading: { type: 'text', content: { text: 'Überschrift' } },
          };
          const next = payloadByType[type] || { type: 'text', content: { text: '' } };
          onContentChange(block.id, next.content);
          if (next.type !== block.type) onContentChange(block.id, { ...next.content, _forceType: next.type });
          setSlashMenu({ open: false, x: 0, y: 0 });
        }}
      />
    </div>
  );
}

function TodoEditor({ items, onChange }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {items.map((item, idx) => (
        <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={!!item.done}
            onChange={(e) => {
              const next = [...items];
              next[idx] = { ...next[idx], done: e.target.checked };
              onChange(next);
            }}
          />
          <input
            value={item.text || ''}
            onChange={(e) => {
              const next = [...items];
              next[idx] = { ...next[idx], text: e.target.value };
              onChange(next);
            }}
            placeholder="Tarea…"
            style={inputStyle}
          />
        </label>
      ))}
      <button
        onClick={() => onChange([...(items || []), { text: '', done: false }])}
        style={smallBtnStyle}
      >
        + ítem
      </button>
    </div>
  );
}

function TableEditor({ rows, onChange }) {
  const safeRows = rows?.length ? rows : [['', ''], ['', '']];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {safeRows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} style={{ border: '1px solid var(--c-border)', padding: 0 }}>
                  <input
                    value={cell || ''}
                    onChange={(e) => {
                      const next = safeRows.map((r) => [...r]);
                      next[rIdx][cIdx] = e.target.value;
                      onChange(next);
                    }}
                    style={{ ...inputStyle, border: 'none', borderRadius: 0, padding: '7px 8px' }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={() => onChange([...safeRows, new Array(safeRows[0].length).fill('')])} style={smallBtnStyle}>+ fila</button>
        <button onClick={() => onChange(safeRows.map((r) => [...r, '']))} style={smallBtnStyle}>+ col</button>
      </div>
    </div>
  );
}

function CodeEditor({ value, language, onChange, onLanguage }) {
  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <input value={language} onChange={(e) => onLanguage(e.target.value)} style={{ ...inputStyle, width: 80 }} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Código…"
        style={{
          width: '100%',
          minHeight: 120,
          border: '1px solid var(--c-border)',
          borderRadius: 8,
          background: '#0f172a',
          color: '#e2e8f0',
          padding: 10,
          fontFamily: '"DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          resize: 'vertical',
          outline: 'none',
        }}
      />
    </div>
  );
}

function ImageEditor({ url, alt, onChange }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <input
        value={url}
        onChange={(e) => onChange({ url: e.target.value })}
        placeholder="https://..."
        style={inputStyle}
      />
      <input
        value={alt}
        onChange={(e) => onChange({ alt: e.target.value })}
        placeholder="Alt text…"
        style={inputStyle}
      />
      {url ? (
        <img src={url} alt={alt || ''} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--c-border)' }} />
      ) : null}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  border: '1px solid var(--c-border)',
  background: 'var(--c-bg)',
  color: 'var(--c-text)',
  borderRadius: 8,
  padding: '7px 8px',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
};

const smallBtnStyle = {
  border: '1px solid var(--c-border)',
  background: 'var(--c-surface)',
  color: 'var(--c-text-2)',
  borderRadius: 7,
  padding: '5px 8px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
