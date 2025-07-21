import React from 'react';
import { Handle, Position } from 'reactflow';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

interface LLMOutputNodeProps {
  data: {
    label: string;
    result?: any;
  };
}

const LLMOutputNode: React.FC<LLMOutputNodeProps> = ({ data }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 min-w-[200px]">
      <Handle type="target" position={Position.Left} className="w-3 h-3" />
      
      <div className="flex items-center space-x-2 mb-3">
        <DocumentTextIcon className="h-5 w-5 text-blue-600" />
        <div>
          <h3 className="text-sm font-medium text-gray-900">{data.label}</h3>
        </div>
      </div>
    </div>
  );
};

export default LLMOutputNode; 