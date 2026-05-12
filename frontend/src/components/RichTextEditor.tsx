import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import announcementService from '../services/announcement.service';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const TOOLBAR_BTN: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface)',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  color: 'var(--color-text-secondary)',
  fontFamily: 'var(--font-sans)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 32,
  transition: 'background 0.15s',
};

const TOOLBAR_BTN_ACTIVE: React.CSSProperties = {
  ...TOOLBAR_BTN,
  background: 'var(--color-brand-100)',
  color: 'var(--color-brand-700)',
  borderColor: 'var(--color-brand-300)',
};

export default function RichTextEditor({ content, onChange, placeholder, style }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({
        HTMLAttributes: { style: 'max-width: 100%; height: auto; border-radius: 8px;' },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { style: 'color: var(--color-brand-600); text-decoration: underline;' },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write your announcement here...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external content changes (e.g. from doc upload)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const addImage = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const result = await announcementService.uploadImage(file);
        if (editor) {
          editor.chain().focus().setImage({ src: result.url, alt: file.name }).run();
        }
      } catch (err) {
        console.error('Image upload failed', err);
        alert('Failed to upload image. Please try again.');
      }
    };
    input.click();
  }, [editor]);

  const addImageByUrl = useCallback(() => {
    const url = window.prompt('Enter image URL:');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter link URL:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', ...style }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-muted)' }}>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          style={editor.isActive('bold') ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
          title="Bold"
        ><b>B</b></button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          style={editor.isActive('italic') ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
          title="Italic"
        ><i>I</i></button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          style={editor.isActive('strike') ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
          title="Strikethrough"
        ><s>S</s></button>
        <span style={{ width: 1, height: 24, background: 'var(--color-border)', margin: '0 4px' }} />
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          style={editor.isActive('heading', { level: 1 }) ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
          title="Heading 1"
        >H1</button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          style={editor.isActive('heading', { level: 2 }) ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
          title="Heading 2"
        >H2</button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          style={editor.isActive('heading', { level: 3 }) ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
          title="Heading 3"
        >H3</button>
        <span style={{ width: 1, height: 24, background: 'var(--color-border)', margin: '0 4px' }} />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          style={editor.isActive('bulletList') ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
          title="Bullet List"
        >• List</button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          style={editor.isActive('orderedList') ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
          title="Numbered List"
        >1. List</button>
        <span style={{ width: 1, height: 24, background: 'var(--color-border)', margin: '0 4px' }} />
        <button onClick={setLink} style={editor.isActive('link') ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN} title="Insert/Edit Link">
          🔗
        </button>
        <button onClick={addImageByUrl} style={TOOLBAR_BTN} title="Insert Image from URL">
          🖼️ URL
        </button>
        <button onClick={addImage} style={TOOLBAR_BTN} title="Upload Image">
          📤 Upload
        </button>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} style={{ padding: 0 }} />
    </div>
  );
}