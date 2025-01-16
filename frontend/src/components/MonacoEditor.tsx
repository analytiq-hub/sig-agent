import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  height?: string;
  readOnly?: boolean;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  language = 'markdown',
  height = '400px',
  readOnly = false,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);
  const subscriptionRef = useRef<monaco.IDisposable | null>(null);

  useEffect(() => {
    if (divRef.current) {
      // Create model first
      if (!modelRef.current) {
        modelRef.current = monaco.editor.createModel(value, language);
      }

      // Create editor if it doesn't exist
      if (!editorRef.current) {
        editorRef.current = monaco.editor.create(divRef.current, {
          model: modelRef.current,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          readOnly,
          automaticLayout: true,
          theme: 'vs',
        });

        // Set up change handler
        if (onChange) {
          subscriptionRef.current = editorRef.current.onDidChangeModelContent(() => {
            const newValue = editorRef.current?.getValue() || '';
            onChange(newValue);
          });
        }
      }

      // Update editor properties if they change
      const editor = editorRef.current;
      const model = modelRef.current;
      
      if (editor && model) {
        if (model.getValue() !== value) {
          const position = editor.getPosition();
          model.setValue(value);
          editor.setPosition(position || new monaco.Position(1, 1));
        }

        monaco.editor.setModelLanguage(model, language);
      }
    }

    // Cleanup
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.dispose();
        subscriptionRef.current = null;
      }
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
      if (modelRef.current) {
        modelRef.current.dispose();
        modelRef.current = null;
      }
    };
  }, [language, readOnly]);

  // Update value separately to avoid recreation
  useEffect(() => {
    const model = modelRef.current;
    if (model && model.getValue() !== value) {
      const editor = editorRef.current;
      const position = editor?.getPosition();
      model.setValue(value);
      if (editor && position) {
        editor.setPosition(position);
      }
    }
  }, [value]);

  return (
    <div 
      ref={divRef} 
      style={{ 
        height, 
        width: '100%',
        border: '1px solid #ddd',
        borderRadius: '4px'
      }} 
    />
  );
};

export default MonacoEditor; 