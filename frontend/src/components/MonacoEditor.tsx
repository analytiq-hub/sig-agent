import React, { useRef, useEffect, useLayoutEffect } from 'react';
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

  // Initialize editor once with layout effect
  useEffect(() => {
    if (divRef.current && !editorRef.current) {
      // Create model first
      if (!modelRef.current) {
        modelRef.current = monaco.editor.createModel(value, language);
      }

      // Create editor
      editorRef.current = monaco.editor.create(divRef.current, {
        model: modelRef.current,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        readOnly,
        automaticLayout: true,
        theme: 'vs',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps since we only want to initialize once

  // Cleanup on unmount
  useEffect(() => {
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
  }, []); // Empty deps since this is cleanup only

  // Handle onChange subscription
  useEffect(() => {
    if (editorRef.current) {
      if (subscriptionRef.current) {
        subscriptionRef.current.dispose();
      }
      if (onChange) {
        subscriptionRef.current = editorRef.current.onDidChangeModelContent(() => {
          const newValue = editorRef.current?.getValue() || '';
          onChange(newValue);
        });
      }
    }
  }, [onChange]);

  // Handle readOnly updates
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly });
    }
  }, [readOnly]);

  // Handle value and language updates
  useEffect(() => {
    const editor = editorRef.current;
    const model = modelRef.current;
    
    if (editor && model) {
      monaco.editor.setModelLanguage(model, language);
      if (model.getValue() !== value) {
        const position = editor.getPosition();
        model.setValue(value);
        editor.setPosition(position || new monaco.Position(1, 1));
      }
    }
  }, [value, language]);

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