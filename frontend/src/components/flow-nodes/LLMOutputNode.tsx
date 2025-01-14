import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeData } from '@/types/flows';

interface LLMOutputNodeProps {
  data: NodeData;
}

const LLMOutputNode = ({ data }: LLMOutputNodeProps) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border border-gray-200">
      <Handle type="target" position={Position.Left} />
      
      <div className="flex items-center">
        <div className="ml-2">
          <div className="text-lg font-bold">LLM Output</div>
          <div className="text-gray-500">{data.label}</div>
        </div>
      </div>
      
      {data.result && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(data.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default memo(LLMOutputNode); 