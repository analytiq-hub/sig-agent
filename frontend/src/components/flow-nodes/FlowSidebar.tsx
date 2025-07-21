import React, { useState, useEffect } from 'react';
import { 
  ChatBubbleLeftRightIcon, 
  DocumentTextIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { NodeData, Flow } from '@/types/flows';
import { listFlowsApi, deleteFlowApi } from '@/utils/api';
import { Tag } from '@/types/index';

interface NodeType {
  type: string;
  label: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>;
  data: NodeData;
}

interface FlowSidebarProps {
  organizationId: string;
  refreshTrigger?: number;
  onFlowSelect: (flowId: string) => void;
  availableTags: Tag[];
}

const nodeTypes: NodeType[] = [
  {
    type: 'documentInput',
    label: 'Document Input',
    icon: DocumentTextIcon,
    data: {
      label: 'Document Input',
      documentId: '',
      documentName: ''
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
      label: 'LLM Output'
    }
  }
];

const FlowSidebar: React.FC<FlowSidebarProps> = ({ organizationId, refreshTrigger, onFlowSelect }) => {
  const [savedFlows, setSavedFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSavedFlows(organizationId);
  }, [refreshTrigger, organizationId]);

  const loadSavedFlows = async (organizationId: string) => {
    try {
      setLoading(true);
      const response = await listFlowsApi({ organizationId });
      setSavedFlows(response.flows);
    } catch (error) {
      console.error('Error loading saved flows:', error);
    } finally {
      setLoading(false);
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
      await deleteFlowApi({
        organizationId: organizationId,
        flowId: flowId
      });
      loadSavedFlows(organizationId); // Refresh the list
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
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : savedFlows.length === 0 ? (
          <div className="text-sm text-gray-500">No saved flows</div>
        ) : (
          savedFlows.map((flow) => (
            <div
              key={flow.flow_id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
              onClick={() => onFlowSelect(flow.flow_id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {flow.name}
                </p>
                {flow.description && (
                  <p className="text-xs text-gray-500 truncate">
                    {flow.description}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => handleDelete(e, flow.flow_id)}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FlowSidebar; 