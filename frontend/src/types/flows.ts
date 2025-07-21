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
  flow_revid: string;           // MongoDB's _id
  flow_id: string;              // Stable identifier
  flow_version: number;
  organization_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
}

export interface NodeData {
  label: string;
  documentId?: string;
  documentName?: string;
  promptId?: string;
  promptName?: string;
  result?: Record<string, unknown>;
  content?: string;
  type?: string;
  name?: string;
  // TO DO: review if these are needed
  description?: string;
  required?: boolean;
  accept?: string[];
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
  flows: Flow[];
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