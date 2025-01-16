export interface PromptField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'datetime';
}

export interface PromptConfig {
  name: string;
  content: string;
  schema_name?: string;
  schema_version?: number;
  tag_ids?: string[];
}

export interface Prompt extends PromptConfig {
  id: string;
  version: number;
  created_at: string;
  created_by: string;
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
