import React, { useState, useEffect } from 'react';
import { 
  DocumentIcon, 
  ChatBubbleLeftRightIcon, 
  DocumentTextIcon,
  FolderIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { NodeData, Flow, FlowMetadata } from '@/types/flows';
import { listFlowsApi, deleteFlowApi } from '@/utils/api';
import { Tag } from '@/types/index';
import colors from 'tailwindcss/colors';
import { isColorLight } from '@/utils/colors';

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

const FlowSidebar: React.FC<FlowSidebarProps> = ({ organizationId, refreshTrigger, onFlowSelect, availableTags }) => {
  const [savedFlows, setSavedFlows] = useState<FlowMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSavedFlows(organizationId);
  }, [refreshTrigger, organizationId]);

  const loadSavedFlows = async (organizationId: string) => {
    try {
      setIsLoading(true);
      const response = await listFlowsApi({
        organizationId: organizationId
      });
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
      await deleteFlowApi({
        organizationId: organizationId,
        flowId: flowId
      });
      loadSavedFlows(organizationId); // Refresh the list
    } catch (error) {
      console.error('Error deleting flow:', error);
    }
  };

  const renderTags = (tags: Tag[]) => {
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className={`
              inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium
              ${tag.color ? 
                `bg-${tag.color}-100 text-${tag.color}-800` : 
                'bg-gray-100 text-gray-800'
              }
            `}
          >
            {tag.name}
          </span>
        ))}
      </div>
    );
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
              className="flex flex-col p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors group"
              onClick={() => onFlowSelect(flow.id)}
            >
              <div className="flex items-center justify-between">
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
              {flow.tag_ids && flow.tag_ids.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {flow.tag_ids.map(tagId => {
                    const tag = availableTags.find(t => t.id === tagId);
                    if (!tag) return null;
                    const textColor = isColorLight(tag.color || '') ? 'text-gray-800' : 'text-white';
                    return (
                      <span
                        key={tag.id}
                        className={`px-1.5 py-0.5 text-xs leading-none rounded shadow-sm ${textColor}`}
                        style={{ 
                          backgroundColor: tag.color || colors.blue[500]
                        }}
                      >
                        {tag.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FlowSidebar; 