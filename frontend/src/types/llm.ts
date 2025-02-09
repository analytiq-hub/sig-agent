export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  max_tokens: number;
  cost_per_1m_input_tokens: number;
  cost_per_1m_output_tokens: number;
}

export interface ListLLMModelsResponse {
  models: LLMModel[];
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface RunLLMParams {
  organizationId: string;
  documentId: string;
  promptId: string;
  force: boolean;
}

export interface RunLLMResponse {
  status: string;
  result: Record<string, JsonValue>;
}

export interface GetLLMResultParams {
  organizationId: string;
  documentId: string;
  promptId: string;
}

export interface GetLLMResultResponse {
  prompt_id: string;
  document_id: string;
  llm_result: Record<string, JsonValue>;
  updated_llm_result: Record<string, JsonValue>;
  is_edited: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeleteLLMResultParams {
  organizationId: string;
  documentId: string;
  promptId: string;
}