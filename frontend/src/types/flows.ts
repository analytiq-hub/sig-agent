import { Node, Edge } from 'reactflow';
import { Prompt } from './prompts';

export interface FlowConfig {
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  tag_ids?: string[];
}

export interface Flow extends FlowConfig {
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

export interface CreateFlowParams {
  organizationId: string;
  flow: FlowConfig;
}

export interface UpdateFlowParams {
  organizationId: string;
  flowId: string;
  flow: FlowConfig;
}

export interface ListFlowsParams {
  organizationId: string;
  skip?: number;
  limit?: number;
}

export interface ListFlowsResponse {
  flows: FlowMetadata[];
  total_count: number;
  skip: number;
}

export interface GetFlowParams {
  organizationId: string;
  flowId: string;
}

export interface DeleteFlowParams {
  organizationId: string;
  flowId: string;
}