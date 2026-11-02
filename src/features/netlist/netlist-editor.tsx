/**
 * SPICE netlist editor: a plain <textarea> with a synced line-number gutter.
 * Ctrl/Cmd+Enter runs the simulation. Tab is NOT trapped (keyboard users can leave).
 */
import { useRef } from 'react';

interface NetlistEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSimulate?: () => void;
  label: string;
  id?: string;
  describedBy?: string;
}

export function NetlistEditor({ value, onChange, onSimulate, label, id = 'netlist', describedBy }: NetlistEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = Math.max(value.split('\n').length, 12);

  return (
    <div className="editor" data-testid="netlist-editor-container">
      <div className="editor-gutter" ref={gutterRef} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <textarea
        ref={taRef}
        id={id}
        className="editor-text"
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={label}
        aria-describedby={describedBy}
        data-testid="netlist-editor"
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            onSimulate?.();
          }
        }}
      />
    </div>
  );
}
