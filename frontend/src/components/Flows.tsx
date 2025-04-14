import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  Connection,
  Edge,
  Node,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowInstance,
  MarkerType,
  NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';

import DocumentNode from '@/components/flow-nodes/DocumentNode';
import PromptNode from '@/components/flow-nodes/PromptNode';
import LLMOutputNode from '@/components/flow-nodes/LLMOutputNode';
import FlowSidebar from '@/components/flow-nodes/FlowSidebar';
import { Flow } from '@/types';
import { Prompt } from '@/types/prompts';
import { useFlowContext } from '@/contexts/FlowContext';
import { listPromptsApi, runLLMApi, createFlowApi, listTagsApi, getFlowApi, updateFlowApi } from '@/utils/api';
import SaveFlowModal from '@/components/flow-nodes/SaveFlowModal';
import { Tag } from '@/types/index';

const Flows: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const { nodeData, updateNodeData, clearNodeData } = useFlowContext();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [refreshSidebarTrigger, setRefreshSidebarTrigger] = useState(0);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [currentFlow, setCurrentFlow] = useState<Flow | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [promptsResponse, tagsResponse] = await Promise.all([
          listPromptsApi({organizationId: organizationId}),
          listTagsApi({organizationId: organizationId})
        ]);
        setPrompts(promptsResponse.prompts);
        setAvailableTags(tagsResponse.tags);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, [organizationId]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const data = JSON.parse(event.dataTransfer.getData('application/reactflow'));
      
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode = {
        id: `${data.type}-${Date.now()}`,
        type: data.type,
        position,
        data: data.data,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const hasPath = useCallback((edges: Edge[], from: string | null, to: string | null, visited = new Set<string>()): boolean => {
    if (!from || !to) return false;
    if (from === to) return true;
    if (visited.has(from)) return false;
    
    visited.add(from);
    return edges.some(edge => 
      edge.source === from && hasPath(edges, edge.target, to, visited)
    );
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      // Validate connection
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      if (!sourceNode || !targetNode) return;
      
      // Prevent cycles
      if (hasPath(edges, params.target, params.source)) {
        alert('Cannot create cyclic dependencies');
        return;
      }
      
      // Add edge with arrow marker
      const edge = {
        ...params,
        type: 'smoothstep',  // smooth curved edges
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        style: {
          strokeWidth: 2,
        },
      };
      
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges, nodes, edges, hasPath]
  );

  const executeFlow = async () => {
    setIsExecuting(true);
    try {
      const sortedNodes = topologicalSort(nodes, edges);
      
      // Execute nodes in order
      for (const node of sortedNodes) {
        await executeNode(node);
      }
    } catch (error) {
      console.error('Flow execution failed:', error);
      alert('Flow execution failed: ' + (error as Error).message);
    } finally {
      setIsExecuting(false);
    }
  };

  const executeNode = async (node: Node) => {
    try {
      const inputEdges = edges.filter(e => e.target === node.id);
      const inputData = inputEdges.map(edge => nodeData[edge.source]);

      switch (node.type) {
        case 'fileInput': {
          if (!node.data.file) {
            throw new Error(`File not selected for node ${node.data.label}`);
          }
          
          const content = await readFileContent(node.data.file);
          updateNodeData(node.id, {
            label: node.data.label,
            content,
            type: node.data.file.type,
            name: node.data.file.name
          });
          break;
        }

        case 'prompt': {
          if (!node.data.promptId) {
            throw new Error(`Prompt not selected for node ${node.data.label}`);
          }

          const result = await runLLMApi({
            organizationId: organizationId,
            documentId: "TO DO: get documentId from node data",
            promptId: node.data.promptId,
            force: true,
          });

          updateNodeData(node.id, {
            label: node.data.label,
            ...result
          });
          break;
        }

        case 'llmOutput': {
          const result = inputData.reduce((acc, input) => ({
            ...acc,
            ...input
          }), {});

          setNodes(nds => 
            nds.map(n => 
              n.id === node.id 
                ? { ...n, data: { ...n.data, result } }
                : n
            )
          );

          updateNodeData(node.id, {
            label: node.data.label,
            ...result
          });
          break;
        }
      }
    } catch (error) {
      console.error(`Error executing node ${node.id}:`, error);
      throw error;
    }
  };

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      
      reader.onerror = (e) => {
        reject(new Error(`Error reading file: ${e}`));
      };

      if (file.type === 'application/json') {
        reader.readAsText(file);
      } else if (file.type.includes('spreadsheet') || file.type.includes('excel')) {
        // For Excel files, we'll need to use a library like xlsx
        // This is a placeholder for now
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  const handlePromptSelect = useCallback((nodeId: string, promptId: string) => {
    const selectedPrompt = prompts.find(p => p.prompt_revid === promptId);
    setNodes(nds => 
      nds.map(n => 
        n.id === nodeId 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                promptId,
                promptName: selectedPrompt?.name 
              } 
            }
          : n
      )
    );
  }, [setNodes, prompts]);

  const handleFileSelect = useCallback((nodeId: string, file: File) => {
    setNodes(nds => 
      nds.map(n => 
        n.id === nodeId 
          ? { ...n, data: { ...n.data, file } }
          : n
      )
    );
  }, [setNodes]);

  const topologicalSort = (nodes: Node[], edges: Edge[]): Node[] => {
    const sorted: Node[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (nodeId: string) => {
      if (temp.has(nodeId)) throw new Error('Cyclic dependency detected');
      if (visited.has(nodeId)) return;

      temp.add(nodeId);
      const outgoingEdges = edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        visit(edge.target);
      }
      temp.delete(nodeId);
      visited.add(nodeId);
      sorted.unshift(nodes.find(n => n.id === nodeId)!);
    };

    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
    });

    return sorted;
  };

  const validateFlow = (): string | null => {
    // Check for trigger document
    const hasTrigger = nodes.some(node => 
      node.type === 'document'
    );
    if (!hasTrigger) {
      return 'Flow must contain a document';
    }

    // Check for loose connections
    const connectedNodes = new Set<string>();
    edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    const looseNodes = nodes.filter(node => !connectedNodes.has(node.id));
    if (looseNodes.length > 0) {
      return 'All nodes must be connected';
    }

    return null;
  };

  const handleSaveFlow = async (name: string, description: string, tagIds: string[]) => {
    const error = validateFlow();
    if (error) {
      throw new Error(error);
    }

    const flowData = {
      name,
      description,
      nodes,
      edges,
      tag_ids: tagIds
    };

    try {
      if (currentFlowId) {
        // Update existing flow
        await updateFlowApi({
          organizationId: organizationId,
          flowId: currentFlowId,
          flow: flowData
        });
      } else {
        // Create new flow
        await createFlowApi({
          organizationId: organizationId,
          flow: flowData
        });
      }
      // Trigger sidebar refresh after successful save
      setRefreshSidebarTrigger(prev => prev + 1);
      setShowSaveModal(false);
    } catch (error) {
      console.error('Error saving flow:', error);
      throw error;
    }
  };

  const handleFlowSelect = async (flowId: string) => {
    try {
      // Clear existing flow
      setNodes([]);
      setEdges([]);
      clearNodeData();

      // Load selected flow
      const flow = await getFlowApi({
        organizationId: organizationId,
        flowId: flowId
      });
      
      console.log('Selected flow:', flow);
      
      // Set nodes and edges from the loaded flow
      setNodes(flow.nodes.map(node => ({
        ...node,
        position: node.position || { x: 0, y: 0 }
      })));
      setEdges(flow.edges);
      
      // Store the current flow
      setCurrentFlow(flow);
      setCurrentFlowId(flowId);
      
    } catch (error) {
      console.error('Error loading flow:', error);
    }
  };

  const handleClearFlow = () => {
    setNodes([]);
    setEdges([]);
    clearNodeData();
    setCurrentFlowId(null);
    setCurrentFlow(null);
  };

  // Create nodeTypes inside component using useMemo
  const nodeTypes = useMemo(() => ({
    document: (props: NodeProps) => (
      <DocumentNode {...props} handleFileSelect={handleFileSelect} />
    ),
    prompt: (props: NodeProps) => (
      <PromptNode {...props} prompts={prompts} handlePromptSelect={handlePromptSelect} />
    ),
    llmOutput: (props: NodeProps) => (
      <LLMOutputNode {...props} />
    ),
  }), [handleFileSelect, handlePromptSelect, prompts]);

  return (
    <div className="flex h-[800px]">
      <FlowSidebar 
        organizationId={organizationId}
        refreshTrigger={refreshSidebarTrigger} 
        onFlowSelect={handleFlowSelect}
        availableTags={availableTags}
      />
      <div className="flex-1">
        <div className="mb-4 flex gap-2 p-4">
          <button
            onClick={executeFlow}
            disabled={isExecuting}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {isExecuting ? 'Executing...' : 'Execute Flow'}
          </button>
          <button
            onClick={handleClearFlow}
            className="px-4 py-2 bg-gray-600 text-white rounded"
          >
            Clear Flow
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {currentFlowId ? 'Update Flow' : 'Save Flow'}
          </button>
        </div>

        <div ref={reactFlowWrapper} className="h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
              },
              style: {
                strokeWidth: 2,
              },
            }}
            defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
            fitView
            fitViewOptions={{ 
              padding: 0.2,
              maxZoom: 1,
              minZoom: 0.1
            }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>
      <SaveFlowModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveFlow}
        availableTags={availableTags}
        initialValues={currentFlow ? {
          name: currentFlow.name,
          description: currentFlow.description,
          tag_ids: currentFlow.tag_ids || []
        } : undefined}
      />
    </div>
  );
};

export default Flows;
