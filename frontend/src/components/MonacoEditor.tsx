import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  height?: string;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  language = 'json',
  height = '200px',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      // Define custom theme
      monaco.editor.defineTheme('customTheme', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#FFFFFF',
          'editor.lineHighlightBackground': '#F9FAFB',
          'editorLineNumber.foreground': '#6B7280',
          'editorLineNumber.activeForeground': '#374151',
          'editor.selectionBackground': '#E5E7EB',
        },
      });

      editor.current = monaco.editor.create(editorRef.current, {
        value,
        language,
        theme: 'customTheme',
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: 'on',
        lineNumbersMinChars: 3,
        padding: { top: 12, bottom: 12 },
        roundedSelection: false,
        renderLineHighlight: 'all',
        scrollbar: {
          useShadows: false,
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          vertical: 'visible',
          horizontal: 'visible',
        },
        overviewRulerLanes: 0,
        lineDecorationsWidth: 8,
        renderIndentGuides: true,
        contextmenu: true,
        fontFamily: "'Geist Mono', monospace",
        fontLigatures: true,
      });

      editor.current.onDidChangeModelContent(() => {
        onChange?.(editor.current?.getValue() || '');
      });

      return () => {
        editor.current?.dispose();
      };
    }
  }, []);

  useEffect(() => {
    if (editor.current) {
      const currentValue = editor.current.getValue();
      if (value !== currentValue) {
        editor.current.setValue(value);
      }
    }
  }, [value]);

  return (
    <div 
      ref={editorRef} 
      style={{ height, width: '100%' }}
      className="border-0 rounded-lg overflow-hidden"
    />
  );
};

export default MonacoEditor; 