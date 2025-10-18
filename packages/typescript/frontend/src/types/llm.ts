export interface LLMModel {
  litellm_model: string;
  litellm_provider: string;
  max_input_tokens: number;
  max_output_tokens: number;
  input_cost_per_token: number;
  output_cost_per_token: number;
}

export interface ListLLMModelsParams {
  providerName: string | null;
  providerEnabled: boolean | null;
  llmEnabled: boolean | null;
}

export interface ListLLMModelsResponse {
  models: LLMModel[];
}

export interface LLMProvider {
  name: string;
  display_name: string;
  litellm_provider: string;
  litellm_models_enabled: string[];
  litellm_models_available: string[];
  enabled: boolean;
  token: string | null;
  token_created_at: string | null;
}

export interface ListLLMProvidersResponse {
  providers: LLMProvider[];
}

export interface SetLLMProviderConfigRequest {
  litellm_models_enabled: string[] | null;
  enabled: boolean | null;
  token: string | null;
}


