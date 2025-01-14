export type FlowNodeType = 'file_input' | 'prompt' | 'llm_output' | 'transform';

export interface NodeData {
  label: string;
  // File input specific
  accept?: string[];
  required?: boolean;
  file?: File;
  
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