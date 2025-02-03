import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { LLMOutputNodeProps } from '@/types/flows';

const LLMOutputNode: React.FC<LLMOutputNodeProps> = ({ data }) => {
  return (
    <div className="origin-top-left px-4 py-2 shadow-md rounded-md bg-white border border-gray-200">
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2"
      />
      <div className="flex items-center">
        <div className="ml-2">
          <div className="text-sm font-bold">{data.label}</div>
          {data.description && (
            <div className="text-xs text-gray-500">{data.description}</div>
          )}
        </div>
      </div>
      {data.result && (
        <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(data.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default memo(LLMOutputNode); 