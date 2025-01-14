import React, { useState, useEffect } from 'react';
import { 
  DocumentIcon, 
  ChatBubbleLeftRightIcon, 
  DocumentTextIcon,
  FolderIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { NodeData, Flow, FlowMetadata } from '@/types/flows';
import { getFlowsApi, deleteFlowApi } from '@/utils/api';

interface NodeType {
  type: string;
  label: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>;
  data: NodeData;
}

interface FlowSidebarProps {
  refreshTrigger?: number;
  onFlowSelect: (flowId: string) => void;
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
    data: { 
      label: 'LLM Output',
      description: 'Display LLM processing results'
    }
  }
];

const FlowSidebar: React.FC<FlowSidebarProps> = ({ refreshTrigger, onFlowSelect }) => {
  const [savedFlows, setSavedFlows] = useState<FlowMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSavedFlows();
  }, [refreshTrigger]);

  const loadSavedFlows = async () => {
    try {
      setIsLoading(true);
      const response = await getFlowsApi();
      setSavedFlows(response.flows);
    } catch (error) {
      console.error('Error loading flows:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onDragStart = (event: React.DragEvent, nodeType: string, data: NodeData | Flow) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      type: nodeType,
      data
    }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDelete = async (e: React.MouseEvent, flowId: string) => {
    e.stopPropagation(); // Prevent flow selection when clicking delete
    try {
      await deleteFlowApi(flowId);
      loadSavedFlows(); // Refresh the list
    } catch (error) {
      console.error('Error deleting flow:', error);
    }
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

      <h3 className="text-sm font-semibold text-gray-900 mt-8 mb-4">Saved Flows</h3>
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : savedFlows.length === 0 ? (
          <div className="text-sm text-gray-500">No saved flows</div>
        ) : (
          savedFlows.map((flow) => (
            <div
              key={flow.id}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors group"
              onClick={() => onFlowSelect(flow.id)}
            >
              <div className="flex items-center">
                <FolderIcon className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">{flow.name}</span>
              </div>
              <button
                onClick={(e) => handleDelete(e, flow.id)}
                className="hidden group-hover:block p-1 hover:bg-gray-100 rounded"
                title="Delete flow"
              >
                <TrashIcon className="h-4 w-4 text-gray-500 hover:text-red-500" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FlowSidebar; 