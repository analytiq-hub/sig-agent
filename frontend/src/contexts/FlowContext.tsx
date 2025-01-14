import React, { createContext, useContext, useState } from 'react';

interface FlowContextType {
  nodeData: Record<string, any>;
  updateNodeData: (nodeId: string, data: any) => void;
  clearNodeData: () => void;
}

const FlowContext = createContext<FlowContextType | undefined>(undefined);

export const FlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nodeData, setNodeData] = useState<Record<string, any>>({});

  const updateNodeData = (nodeId: string, data: any) => {
    setNodeData(prev => ({
      ...prev,
      [nodeId]: data
    }));
  };

  const clearNodeData = () => {
    setNodeData({});
  };

  return (
    <FlowContext.Provider value={{ nodeData, updateNodeData, clearNodeData }}>
      {children}
    </FlowContext.Provider>
  );
};

export const useFlowContext = () => {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error('useFlowContext must be used within a FlowProvider');
  }
  return context;
}; 