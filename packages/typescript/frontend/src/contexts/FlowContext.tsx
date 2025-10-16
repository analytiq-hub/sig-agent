import React, { createContext, useContext, useState } from 'react';
import { NodeData } from '@/types/flows';

interface FlowContextType {
  nodeData: Record<string, NodeData>;
  updateNodeData: (nodeId: string, data: NodeData) => void;
  clearNodeData: () => void;
}

// Provide initial context value
const initialContext: FlowContextType = {
  nodeData: {},
  updateNodeData: () => {
    throw new Error('updateNodeData not implemented');
  },
  clearNodeData: () => {
    throw new Error('clearNodeData not implemented');
  },
};

const FlowContext = createContext<FlowContextType>(initialContext);

export const FlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  const [nodeData, setNodeData] = useState<Record<string, NodeData>>({});

  const updateNodeData = (nodeId: string, data: NodeData): void => {
    setNodeData(prev => ({
      ...prev,
      [nodeId]: data
    }));
  };

  const clearNodeData = (): void => {
    setNodeData({});
  };

  return (
    <FlowContext.Provider value={{ nodeData, updateNodeData, clearNodeData }}>
      {children}
    </FlowContext.Provider>
  );
};

export const useFlowContext = (): FlowContextType => {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error('useFlowContext must be used within a FlowProvider');
  }
  return context;
}; 