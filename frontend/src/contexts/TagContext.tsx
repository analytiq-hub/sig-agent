import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Tag } from '@/types/index';

interface TagContextType {
  editingTag: Tag | null;
  setEditingTag: (tag: Tag | null) => void;
}

const TagContext = createContext<TagContextType | undefined>(undefined);

export const TagProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  return (
    <TagContext.Provider value={{ 
      editingTag, 
      setEditingTag
    }}>
      {children}
    </TagContext.Provider>
  );
};

export const useTagContext = () => {
  const context = useContext(TagContext);
  if (context === undefined) {
    throw new Error('useTagContext must be used within a TagProvider');
  }
  return context;
}; 