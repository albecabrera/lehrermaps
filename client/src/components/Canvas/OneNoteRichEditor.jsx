import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';

const STORAGE_KEY = 'lm_editor_rich';

export default function OneNoteRichEditor({ pageId, activeTab, mode = 'onenote' }) {
  const storageKey = useMemo(() => `${STORAGE_KEY}:${pageId}`, [pageId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ allowBase64: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'onenote-editor',
        spellcheck: 'true',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const saved = localStorage.getItem(storageKey);
    editor.commands.setContent(saved || '<p></p>', false);
  }, [editor, storageKey]);

  useEffect(() => {
    if (!editor) return;
    let timeout;
    const onUpdate = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.setItem(storageKey, editor.getHTML());
      }, 600);
    };
    editor.on('update', onUpdate);
    return () => {
      clearTimeout(timeout);
      editor.off('update', onUpdate);
    };
  }, [editor, storageKey]);

  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt('URL de la imagen:');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const tools = [
    { label: 'B', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { label: 'U', action: () => editor.chain().focus().toggleUnderline?.().run?.(), active: false, hide: true },
    { label: '•', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
    { label: '☑', action: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive('taskList') },
    { label: 'H1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
    { label: 'Tabla', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), active: false },
    { label: 'Código', action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock') },
    { label: 'Imagen', action: addImage, active: false },
    { label: 'Undo', action: () => editor.chain().focus().undo().run(), active: false },
    { label: 'Redo', action: () => editor.chain().focus().redo().run(), active: false },
  ];

  return (
    <>
      <style>{`
        .onenote-editor { min-height: 1200px; outline: none; font-family: ${mode === 'docs' ? 'Inter, DM Sans, sans-serif' : 'Calibri, DM Sans, sans-serif'}; font-size: 16px; line-height: ${mode === 'docs' ? '1.7' : '1.8'}; color: #111; direction: ltr; text-align: left; max-width:${mode === 'docs' ? '900px' : 'none'}; margin:${mode === 'docs' ? '0 auto' : '0'}; background:${mode === 'docs' ? '#fff' : 'transparent'}; padding:${mode === 'docs' ? '22px 28px' : '0'}; border-radius:${mode === 'docs' ? '12px' : '0'}; box-shadow:${mode === 'docs' ? '0 10px 24px rgba(0,0,0,.08)' : 'none'}; }
        .onenote-editor p { margin: 0; min-height: 34px; }
        .onenote-editor h1, .onenote-editor h2, .onenote-editor h3 { margin: 8px 0 0; line-height: 1.4; }
        .onenote-editor ul, .onenote-editor ol { margin: 6px 0 6px 22px; }
        .onenote-editor pre { background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 10px; }
        .onenote-editor table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .onenote-editor th, .onenote-editor td { border: 1px solid #c9ccd3; padding: 6px; vertical-align: top; }
        .onenote-editor img { max-width: 100%; border-radius: 6px; }
      `}</style>
      <div style={{ minHeight: 86, borderBottom: '1px solid #d8d8de', background: '#f1f1f4', display: 'flex', alignItems: 'stretch', gap: 8, padding: '6px 12px', overflowX: 'auto' }}>
        {tools.filter((t) => !t.hide).map((tool) => (
          <button
            key={tool.label}
            onClick={tool.action}
            style={{
              minWidth: 64,
              border: '1px solid #cfcfd4',
              background: tool.active ? '#ece8f7' : '#fff',
              color: '#333',
              borderRadius: 4,
              padding: '7px 10px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {tool.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#666', alignSelf: 'center' }}>{activeTab}</span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          position: 'relative',
          backgroundColor: mode === 'docs' ? '#f4f5f8' : '#fff',
          backgroundImage: mode === 'docs'
            ? 'none'
            : 'linear-gradient(to right, transparent 74px, #ef9a9a 74px, #ef9a9a 75px, transparent 75px), linear-gradient(to bottom, rgba(173,216,230,.65) 1px, transparent 1px)',
          backgroundSize: mode === 'docs' ? 'auto' : '100% 34px',
        }}
      >
        <div style={{ padding: mode === 'docs' ? '30px 28px 90px' : '90px 40px 140px 88px', minHeight: 1600 }}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}
