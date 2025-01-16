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
}

export interface DeleteLLMResultParams {
  organizationId: string;
  documentId: string;
  promptId: string;
}
