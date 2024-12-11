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
  const editorRef = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      // Configure markdown syntax highlighting only if not already registered
      if (!monaco.languages.getLanguages().some(lang => lang.id === 'markdown')) {
        monaco.languages.register({ id: 'markdown' });
        
        // Add Markdown syntax highlighting rules
        monaco.languages.setMonarchTokensProvider('markdown', {
          tokenizer: {
            root: [
              // Headers
              [/^#{1,6}\s.*$/, 'heading'],
              // Bold
              [/\*\*([^*]+)\*\*/, 'strong'],
              [/__([^_]+)__/, 'strong'],
              // Italic
              [/\*([^*]+)\*/, 'emphasis'],
              [/_([^_]+)_/, 'emphasis'],
              // Code blocks
              [/```json[\s\S]*?```/, 'jsonblock'], // Special handling for JSON blocks
              [/```[\s\S]*?```/, 'code'],
              [/`[^`]+`/, 'code'],
              // Lists
              [/^\s*[\-\*\+]\s+.*$/, 'list'],
              [/^\s*\d+\.\s+.*$/, 'list'],
              // Links
              [/\[([^\]]+)\]\(([^\)]+)\)/, 'link'],
              // Special keywords for prompts
              [/(System|User|Assistant):/, 'keyword'],
              // JSON within markdown (for code blocks)
              { include: 'json' }
            ],
            json: [
              [/".*?"/, 'string'],
              [/[{}\[\]]/, 'delimiter.bracket'],
              [/[0-9]+/, 'number'],
              [/true|false|null/, 'keyword'],
              [/[,:]/, 'delimiter'],
            ]
          }
        });
      }

      // Define custom theme optimized for both markdown and JSON
      monaco.editor.defineTheme('promptTheme', {
        base: 'vs',
        inherit: true,
        rules: [
          // Markdown tokens
          { token: 'heading', foreground: '0000FF', fontStyle: 'bold' },
          { token: 'strong', fontStyle: 'bold' },
          { token: 'emphasis', fontStyle: 'italic' },
          { token: 'keyword', foreground: '0000FF' },
          { token: 'code', foreground: 'D121C5' },
          { token: 'jsonblock', foreground: '098658' },
          { token: 'link', foreground: '0066CC' },
          { token: 'list', foreground: '0000FF' },
          // JSON tokens
          { token: 'string', foreground: '098658' },
          { token: 'number', foreground: '098658' },
          { token: 'delimiter.bracket', foreground: '800080' },
          { token: 'delimiter', foreground: '800080' },
        ],
        colors: {
          'editor.background': '#FFFFFF',
          'editor.lineHighlightBackground': '#F9FAFB',
          'editorLineNumber.foreground': '#6B7280',
          'editorLineNumber.activeForeground': '#374151',
          'editor.selectionBackground': '#E5E7EB',
          'editor.wordHighlightBackground': '#FFEB3B40',
          'editor.wordHighlightStrongBackground': '#FFA50040',
        },
      });

      editor.current = monaco.editor.create(editorRef.current, {
        value,
        language,
        theme: 'promptTheme',
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: 'on',
        lineNumbersMinChars: 3,
        padding: { top: 12, bottom: 12 },
        roundedSelection: false,
        renderLineHighlight: 'all',
        wordWrap: 'on',
        wrappingStrategy: 'advanced',
        scrollbar: {
          useShadows: false,
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          vertical: 'visible',
          horizontal: 'visible',
        },
        overviewRulerLanes: 0,
        lineDecorationsWidth: 8,
        guides: {
          indentation: true,
          bracketPairs: true,
        },
        bracketPairColorization: {
          enabled: true,
        },
        contextmenu: true,
        fontFamily: "'Geist Mono', monospace",
        fontLigatures: true,
        readOnly: readOnly,
        suggestOnTriggerCharacters: true,
        quickSuggestions: {
          other: true,
          comments: true,
          strings: true,
        },
        wordBasedSuggestions: 'currentDocument',
      });

      // Add custom completions for common prompt patterns
      monaco.languages.registerCompletionItemProvider('markdown', {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };
          
          const suggestions = [
            {
              label: 'system',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'System: You are a helpful assistant that ${1:description}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Insert a system message',
              range
            },
            {
              label: 'user',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'User: ${1:message}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Insert a user message',
              range
            },
            {
              label: 'assistant',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'Assistant: ${1:response}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Insert an assistant message',
              range
            },
          ];
          return { suggestions };
        }
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