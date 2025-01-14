export type FlowNodeType = 'triggerDocument' | 'staticDocument' | 'prompt' | 'llm_output' | 'transform';

export interface NodeData {
  label: string;
  description?: string;
  // File input specific
  accept?: string[];
  required?: boolean;
  file?: File;
  isTrigger?: boolean;
  isStatic?: boolean;
  
  // Prompt specific
  promptId?: string;
  promptName?: string;
  
  // Transform specific
  transformType?: 'json_to_table' | 'extract_field' | 'custom';
  transformConfig?: {
    field?: string;
    format?: string;
    template?: string;
  };
  
  // LLM output specific
  result?: Record<string, unknown>;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  name: string;
  position: { x: number; y: number };
  data: NodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  created_at: string;
  created_by: string;
  version: number;
}

export interface FlowMetadata {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  created_by: string;
  version: number;
}

export interface SaveFlowRequest {
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface ListFlowsResponse {
  flows: FlowMetadata[];
  total_count: number;
  skip: number;
}

export interface DocumentNodeProps {
  id: string;
  data: NodeData;
  handleFileSelect: (nodeId: string, file: File) => void;
}

export interface PromptNodeProps {
  id: string;
  data: NodeData;
  prompts: Prompt[];
  handlePromptSelect: (nodeId: string, promptId: string) => void;
}

export interface LLMOutputNodeProps {
  data: NodeData;
} 