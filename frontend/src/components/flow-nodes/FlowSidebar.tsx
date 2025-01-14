import React from 'react';
import { 
  DocumentIcon, 
  ChatBubbleLeftRightIcon, 
  DocumentTextIcon 
} from '@heroicons/react/24/outline';
import { NodeData } from '@/types/flows';

interface NodeType {
  type: string;
  label: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>;
  data: NodeData;
}

const nodeTypes: NodeType[] = [
  {
    type: 'triggerDocument',
    label: 'Trigger Document',
    icon: DocumentIcon,
    data: { 
      label: 'Trigger Document',
      description: 'Uploaded document that triggers the flow',
      accept: ['.pdf', '.txt', '.json', '.xlsx'],
      required: true,
      isTrigger: true
    }
  },
  {
    type: 'staticDocument',
    label: 'Static Document',
    icon: DocumentIcon,
    data: { 
      label: 'Static Document',
      description: 'Reference document that remains unchanged',
      accept: ['.pdf', '.txt', '.json', '.xlsx'],
      required: true,
      isStatic: true
    }
  },
  {
    type: 'prompt',
    label: 'Prompt',
    icon: ChatBubbleLeftRightIcon,
    data: { label: 'Prompt' }
  },
  {
    type: 'llmOutput',
    label: 'LLM Output',
    icon: DocumentTextIcon,
    data: { label: 'Output' }
  }
];

const FlowSidebar = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string, data: NodeData) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      type: nodeType,
      data
    }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Flow Elements</h3>
      <div className="space-y-2">
        {nodeTypes.map((node) => {
          const Icon = node.icon;
          return (
            <div
              key={node.type}
              className="flex items-center p-3 bg-white border border-gray-200 rounded-lg cursor-move hover:bg-gray-50 transition-colors"
              draggable
              onDragStart={(e) => onDragStart(e, node.type, node.data)}
            >
              <Icon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm text-gray-900">{node.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FlowSidebar; 