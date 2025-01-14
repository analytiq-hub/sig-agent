import React, { memo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeData } from '@/types/flows';

interface DocumentNodeProps {
  id: string;
  data: NodeData;
  handleFileSelect: (nodeId: string, file: File) => void;
}

const DocumentNode = ({ id, data, handleFileSelect }: DocumentNodeProps) => {
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(id, file);
    }
  }, [id, handleFileSelect]);

  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border border-gray-200">
      <Handle type="source" position={Position.Right} />
      
      <div className="flex items-center">
        <div className="ml-2">
          <div className="text-lg font-bold">{data.label}</div>
          <div className="text-gray-500">
            {data.description}
            {data.required && <span className="text-red-500 ml-1">*</span>}
          </div>
        </div>
      </div>
      
      <input
        type="file"
        className="mt-2 block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100"
        accept={data.accept?.join(',')}
        required={data.required}
        onChange={handleFileChange}
      />
    </div>
  );
};

export default memo(DocumentNode); 