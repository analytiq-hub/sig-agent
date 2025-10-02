import { HttpClient } from '../http-client';
import {
  LLMChatRequest,
  LLMChatResponse,
  LLMChatStreamChunk,
  LLMChatStreamError,
  ListLLMModelsParams,
  ListLLMModelsResponse,
  ListLLMProvidersResponse,
  SetLLMProviderConfigRequest,
  RunLLMParams,
  RunLLMResponse,
  GetLLMResultParams,
  GetLLMResultResponse,
  DeleteLLMResultParams,
} from '../types';

export class LLMAPI {
  constructor(private http: HttpClient) {}

  async listModels(params: ListLLMModelsParams): Promise<ListLLMModelsResponse> {
    return this.http.get<ListLLMModelsResponse>('/v0/account/llm/models', {
      params: {
        provider_name: params.providerName,
        provider_enabled: params.providerEnabled,
        llm_enabled: params.llmEnabled,
      }
    });
  }

  async listProviders(): Promise<ListLLMProvidersResponse> {
    return this.http.get<ListLLMProvidersResponse>('/v0/account/llm/providers');
  }

  async setProviderConfig(providerName: string, request: SetLLMProviderConfigRequest) {
    return this.http.put<SetLLMProviderConfigRequest>(`/v0/account/llm/provider/${providerName}`, request);
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    return this.http.post<LLMChatResponse>('/v0/account/llm/run', request);
  }

  async chatOrg(organizationId: string, request: LLMChatRequest): Promise<LLMChatResponse> {
    return this.http.post<LLMChatResponse>(`/v0/orgs/${organizationId}/llm/run`, request);
  }

  async chatStream(
    request: LLMChatRequest,
    onChunk: (chunk: LLMChatStreamChunk | LLMChatStreamError) => void,
    onError?: (error: Error) => void,
    abortSignal?: AbortSignal
  ): Promise<void> {
    return this.chatStreamImpl('/v0/account/llm/run', request, onChunk, onError, abortSignal);
  }

  async chatStreamOrg(
    organizationId: string,
    request: LLMChatRequest,
    onChunk: (chunk: LLMChatStreamChunk | LLMChatStreamError) => void,
    onError?: (error: Error) => void,
    abortSignal?: AbortSignal
  ): Promise<void> {
    return this.chatStreamImpl(`/v0/orgs/${organizationId}/llm/run`, request, onChunk, onError, abortSignal);
  }

  private async chatStreamImpl(
    endpoint: string,
    request: LLMChatRequest,
    onChunk: (chunk: LLMChatStreamChunk | LLMChatStreamError) => void,
    onError?: (error: Error) => void,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const streamingRequest = { ...request, stream: true };
    return this.http.stream(endpoint, streamingRequest, (chunk: unknown) => {
      onChunk(chunk as LLMChatStreamChunk | LLMChatStreamError);
    }, onError, abortSignal);
  }

  async run(params: RunLLMParams) {
    const { organizationId, documentId, promptRevId, force } = params;
    return this.http.post<RunLLMResponse>(
      `/v0/orgs/${organizationId}/llm/run/${documentId}`,
      {},
      {
        params: {
          prompt_revid: promptRevId,
          force: force
        }
      }
    );
  }

  async getResult(params: GetLLMResultParams) {
    const { organizationId, documentId, promptRevId, fallback } = params;
    return this.http.get<GetLLMResultResponse>(
      `/v0/orgs/${organizationId}/llm/result/${documentId}`,
      {
        params: {
          prompt_revid: promptRevId,
          fallback: fallback
        }
      }
    );
  }

  async updateResult({
    organizationId,
    documentId,
    promptId,
    result,
    isVerified = false
  }: {
    organizationId: string;
    documentId: string;
    promptId: string;
    result: Record<string, unknown>;
    isVerified?: boolean;
  }) {
    const response = await this.http.put<{
      status: number;
      data: unknown;
    }>(
      `/v0/orgs/${organizationId}/llm/result/${documentId}`,
      {
        updated_llm_result: result,
        is_verified: isVerified
      },
      {
        params: {
          prompt_revid: promptId
        }
      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to update LLM result for document ${documentId} and prompt ${promptId}: ${response.data}`);
    }

    return response.data;
  }

  async deleteResult(params: DeleteLLMResultParams) {
    const { organizationId, documentId, promptId } = params;
    return this.http.delete(
      `/v0/orgs/${organizationId}/llm/result/${documentId}`,
      {
        params: {
          prompt_revid: promptId
        }
      }
    );
  }

  async downloadAllResults(params: {
    organizationId: string;
    documentId: string;
  }) {
    const { organizationId, documentId } = params;
    return this.http.get(
      `/v0/orgs/${organizationId}/llm/results/${documentId}/download`,
      {
        responseType: 'blob'
      }
    );
  }
}
