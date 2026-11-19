import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bold,
  Eye,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  PenLine,
  Quote,
} from 'lucide-react';

interface RichMarkdownEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  rows?: number;
}

const RichMarkdownEditor: React.FC<RichMarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write editorial report details using Markdown formatting...',
  rows = 6,
}) => {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const wrapSelection = (before: string, after = '', fallbackText = 'text') => {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}${value && !value.endsWith('\n') ? '\n' : ''}${before}${fallbackText}${after}`);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || fallbackText;
    const updated = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(updated);

    window.requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + selected.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const insertLinePrefix = (prefix: string, fallbackText: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}${value && !value.endsWith('\n') ? '\n' : ''}${prefix}${fallbackText}`);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const selected = value.slice(start, end);

    if (selected) {
      const transformed = selected
        .split('\n')
        .map((line) => (line.trim() ? `${prefix}${line}` : line))
        .join('\n');
      const updated = value.slice(0, start) + transformed + value.slice(end);
      onChange(updated);
      return;
    }

    const needLeadingNewline = start > lineStart && value.slice(lineStart, start).trim().length > 0;
    const insertion = `${needLeadingNewline ? '\n' : ''}${prefix}`;
    const updated = value.slice(0, start) + insertion + value.slice(end);
    onChange(updated);

    window.requestAnimationFrame(() => {
      el.focus();
      const pos = start + insertion.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const toolbarButtons = [
    {
      label: 'Bold',
      icon: Bold,
      onClick: () => wrapSelection('**', '**', 'important insight'),
    },
    {
      label: 'Italic',
      icon: Italic,
      onClick: () => wrapSelection('*', '*', 'emphasis'),
    },
    {
      label: 'Heading',
      icon: Heading2,
      onClick: () => insertLinePrefix('## ', 'What This Report Covers'),
    },
    {
      label: 'Subheading',
      icon: Heading3,
      onClick: () => insertLinePrefix('### ', 'Key Systems Included'),
    },
    {
      label: 'Bullet List',
      icon: List,
      onClick: () => insertLinePrefix('- ', 'Key takeaway point'),
    },
    {
      label: 'Numbered List',
      icon: ListOrdered,
      onClick: () => insertLinePrefix('1. ', 'First analytical pass'),
    },
    {
      label: 'Quote',
      icon: Quote,
      onClick: () => insertLinePrefix('> ', 'Grounded observatory note'),
    },
    {
      label: 'Divider',
      icon: Minus,
      onClick: () =>
        onChange(`${value.trimEnd()}${value.trim() ? '\n\n---\n\n' : '---\n\n'}`),
    },
  ];

  return (
    <div className="rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] overflow-hidden">
      {/* Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3D3830]/10 bg-[#F1ECE3]/80 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {toolbarButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                type="button"
                disabled={tab === 'preview'}
                onClick={btn.onClick}
                title={btn.label}
                aria-label={btn.label}
                className="p-1.5 rounded-lg text-[#5C5449] hover:bg-[#FDFBF7] hover:text-[#3D3830] disabled:opacity-40 transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center rounded-xl bg-[#EAE3D7]/80 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition-colors ${
              tab === 'write'
                ? 'bg-[#FDFBF7] text-[#3D3830] font-medium shadow-2xs'
                : 'text-[#8B8275] hover:text-[#3D3830]'
            }`}
          >
            <PenLine className="h-3 w-3" />
            <span>Write</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition-colors ${
              tab === 'preview'
                ? 'bg-[#FDFBF7] text-[#3D3830] font-medium shadow-2xs'
                : 'text-[#8B8275] hover:text-[#3D3830]'
            }`}
          >
            <Eye className="h-3 w-3" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {tab === 'write' ? (
        <textarea
          ref={textareaRef}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#FAF7F2] p-3.5 text-xs leading-relaxed text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none"
        />
      ) : (
        <div className="min-h-[140px] max-h-72 overflow-y-auto bg-[#FDFBF7] p-4 text-xs text-[#5C5449] leading-relaxed">
          {value.trim() ? (
            <div className="cc-markdown space-y-2.5 [&_h1]:font-serif [&_h1]:text-xl [&_h1]:text-[#3D3830] [&_h2]:font-serif [&_h2]:text-lg [&_h2]:text-[#3D3830] [&_h2]:mt-3 [&_h3]:font-medium [&_h3]:text-[#3D3830] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-[#B8965A] [&_blockquote]:pl-3 [&_blockquote]:italic [&_strong]:text-[#3D3830]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-[#8B8275] italic">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RichMarkdownEditor;
