import { Node, Edge } from 'reactflow';
import { Prompt } from './prompts';

export interface SaveFlowRequest {
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  tag_ids?: string[];
}

export interface Flow extends SaveFlowRequest {
  id: string;
  version: number;
  created_at: string;
  created_by: string;
}

export interface FlowMetadata {
  id: string;
  name: string;
  description?: string;
  version: number;
  created_at: string;
  created_by: string;
  tag_ids?: string[];
}

export interface ListFlowsResponse {
  flows: FlowMetadata[];
  total_count: number;
  skip: number;
}

export interface NodeData {
  label: string;
  description?: string;
  accept?: string[];
  required?: boolean;
  isTrigger?: boolean;
  isStatic?: boolean;
  promptId?: string;
  promptName?: string;
  file?: File;
  result?: Record<string, unknown>;
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