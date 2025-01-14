export * from './AppSession';
export * from './aws_credentials';
export * from './documents';
export * from './invitations';
export * from './llm';
export * from './llm_tokens';
export * from './ocr';
export * from './organizations';
export * from './prompts';
export * from './schemas';
export * from './tags';
export * from './users';
export * from './tokens';

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