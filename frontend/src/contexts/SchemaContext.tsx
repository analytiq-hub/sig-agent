import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Schema } from '@/types/index';

interface SchemaContextType {
  editingSchema: Schema | null;
  setEditingSchema: (schema: Schema | null) => void;
}

const SchemaContext = createContext<SchemaContextType | undefined>(undefined);

export const SchemaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [editingSchema, setEditingSchema] = useState<Schema | null>(null);

  return (
    <SchemaContext.Provider value={{ 
      editingSchema, 
      setEditingSchema
    }}>
      {children}
    </SchemaContext.Provider>
  );
};

export const useSchemaContext = () => {
  const context = useContext(SchemaContext);
  if (context === undefined) {
    throw new Error('useSchemaContext must be used within a SchemaProvider');
  }
  return context;
}; 