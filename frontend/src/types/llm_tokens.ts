export interface CreateLLMTokenRequest {
  llm_vendor: 'OpenAI' | 'Anthropic' | 'Gemini' | 'Groq' | 'Mistral';
  token: string;
}

export interface LLMToken {
  id: string;
  user_id: string;
  llm_vendor: 'OpenAI' | 'Anthropic' | 'Gemini' | 'Groq' | 'Mistral';
  token: string;
  created_at: string;
}