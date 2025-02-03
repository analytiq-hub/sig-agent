import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeData } from '@/types/flows';
import { Prompt } from '@/types/prompts';

interface PromptNodeProps {
  id: string;
  data: NodeData;
  prompts: Prompt[];
  handlePromptSelect: (nodeId: string, promptId: string) => void;
}

const PromptNode = ({ id, data, prompts, handlePromptSelect }: PromptNodeProps) => {
  return (
    <div className="origin-top-left px-4 py-2 shadow-md rounded-md bg-white border border-gray-200">
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      
      <div className="flex items-center">
        <div className="ml-2">
          <div className="text-lg font-bold">Prompt</div>
          <div className="text-gray-500">{data.promptName || 'Select Prompt'}</div>
        </div>
      </div>
      
      <select
        className="mt-2 w-full p-2 border rounded"
        value={data.promptId || ''}
        onChange={(e) => handlePromptSelect(id, e.target.value)}
      >
        <option value="">Select a prompt...</option>
        {prompts.map(prompt => (
          <option key={prompt.id} value={prompt.id}>
            {prompt.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default memo(PromptNode); 