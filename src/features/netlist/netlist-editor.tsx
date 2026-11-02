/**
 * SPICE netlist editor (textarea-based MVP)
 * Features: line-number gutter, error highlighting, keyboard shortcuts
 */

import { useRef, useState } from 'react';
import type { ValidationResult } from './netlist-validator';

interface NetlistEditorProps {
  value: string;
  onChange: (value: string) => void;
  errors?: ValidationResult;
  onSimulate?: () => void;
  className?: string;
}

export function NetlistEditor({
  value,
  onChange,
  errors,
  onSimulate,
  className = '',
}: NetlistEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLPreElement>(null);
  const [cursorLine, setCursorLine] = useState(1);

  // Sync scrollbar between textarea and gutter
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Update cursor line number
  const handleSelect = () => {
    if (textareaRef.current) {
      const { selectionStart } = textareaRef.current;
      const line = value.substring(0, selectionStart).split('\n').length;
      setCursorLine(line);
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onSimulate?.();
    }
  };

  // Count lines
  const lineCount = value ? value.split('\n').length : 1;
  const lines = Array.from({ length: Math.max(lineCount, 20) }, (_, i) => i + 1);

  return (
    <div
      className={`relative flex flex-col h-full ${className}`}
      data-testid="netlist-editor-container"
    >
      <div className="flex-1 relative flex">
        {/* Line number gutter */}
        <pre
          ref={gutterRef}
          className="flex-none w-12 p-4 m-0 text-right text-[#2a4a2a] select-none overflow-hidden leading-6 font-mono text-sm"
          aria-hidden="true"
        >
          {lines.map((n) => (
            <span key={n} className={n === cursorLine ? 'text-[#39ff14]' : ''}>
              {n}
            </span>
          ))}
        </pre>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className="flex-1 w-full p-4 m-0 bg-[#0a0f0a] text-[#39ff14] font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#39ff14] focus:ring-offset-0 leading-6"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          aria-label="SPICE netlist editor"
          data-testid="netlist-editor"
        />
      </div>

      {/* Validation summary */}
      {errors && (errors.errors.length > 0 || errors.warnings.length > 0) && (
        <div className="p-3 bg-[#1a1f1a] text-[#aaff44] text-sm">
          <p className="font-bold mb-1">
            Spirits are restless: {errors.errors.length} error
            {errors.errors.length !== 1 ? 's' : ''}, {errors.warnings.length} warning
            {errors.warnings.length !== 1 ? 's' : ''}
          </p>
          {errors.errors.length > 0 && (
            <ul className="ml-4 list-disc">
              {errors.errors.map((err, i) => (
                <li key={i}>{err.message}</li>
              ))}
            </ul>
          )}
          {errors.warnings.length > 0 && (
            <ul className="ml-4 list-disc text-[#39ff14] opacity-80">
              {errors.warnings.map((warn, i) => (
                <li key={i}>{warn.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
