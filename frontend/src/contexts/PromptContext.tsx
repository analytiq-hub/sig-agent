import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Prompt } from '@/types/index';

interface PromptContextType {
  editingPrompt: Prompt | null;
  setEditingPrompt: (prompt: Prompt | null) => void;
}

const PromptContext = createContext<PromptContextType | undefined>(undefined);

export const PromptProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  return (
    <PromptContext.Provider value={{ 
      editingPrompt, 
      setEditingPrompt
    }}>
      {children}
    </PromptContext.Provider>
  );
};

export const usePromptContext = () => {
  const context = useContext(PromptContext);
  if (context === undefined) {
    throw new Error('usePromptContext must be used within a PromptProvider');
  }
  return context;
}; 