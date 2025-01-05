type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface LLMRunResponse {
  status: string;
  result: Record<string, JsonValue>;
}

export interface LLMResult {
  prompt_id: string;
  document_id: string;
  llm_result: Record<string, JsonValue>;
}