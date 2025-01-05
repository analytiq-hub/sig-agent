export interface PromptField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'datetime';
}

export interface PromptCreate {
  name: string;
  content: string;
  schema_name?: string;
  schema_version?: number;
  tag_ids?: string[];
}

export interface Prompt {
  id: string;
  name: string;
  content: string;
  schema_name: string;
  schema_version: number;
  version: number;
  created_at: string;
  created_by: string;
  tag_ids: string[];
}

export interface ListPromptsResponse {
  prompts: Prompt[];
  total_count: number;
  skip: number;
}

export interface ListPromptsParams {
  skip?: number;
  limit?: number;
  document_id?: string;
  tag_ids?: string;
}
