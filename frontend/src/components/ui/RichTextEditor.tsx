import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import '@/src/styles/editor.css';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  error?: string | null;
  ariaInvalid?: boolean;
  ariaDescribedby?: string;
}

const ToolbarButton: React.FC<{
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  icon: string;
}> = ({ onClick, active, disabled, title, icon }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`material-symbols-outlined text-lg transition-colors px-1 py-0.5 rounded ${
      active
        ? 'text-brand-700 bg-brand-50'
        : 'text-text-tertiary hover:text-brand-700 hover:bg-brand-50/50'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {icon}
  </button>
);

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Provide additional details about your request...',
  disabled = false,
  error,
  ariaInvalid,
  ariaDescribedby,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        hardBreak: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content',
        'aria-invalid': ariaInvalid ? 'true' : undefined,
        'aria-describedby': ariaDescribedby,
      },
    },
  });

  // Sync external value changes into the editor (only on mount / initial set)
  React.useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const currentHTML = editor.getHTML();
      // Only update if truly different to avoid cursor position loss
      if (value !== currentHTML && (value === '' || value === '<p></p>')) {
        editor.commands.setContent(value || '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl || 'https://');
    if (url === null) return; // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border border-cwc-border rounded-cwc-md overflow-hidden focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-700 transition-all">
      {/* Toolbar */}
      <div className="bg-surface-muted/50 border-b border-cwc-border px-4 py-2 flex gap-1 items-center">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          disabled={disabled}
          title="Bold (Ctrl+B)"
          icon="format_bold"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          disabled={disabled}
          title="Italic (Ctrl+I)"
          icon="format_italic"
        />
        <div className="w-px h-5 bg-cwc-border mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          disabled={disabled}
          title="Bullet List"
          icon="format_list_bulleted"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          disabled={disabled}
          title="Numbered List"
          icon="format_list_numbered"
        />
        <div className="w-px h-5 bg-cwc-border mx-1" />
        <ToolbarButton
          onClick={setLink}
          active={editor.isActive('link')}
          disabled={disabled}
          title="Insert Link"
          icon="link"
        />
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-red-600 text-xs font-medium">
          {error}
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;