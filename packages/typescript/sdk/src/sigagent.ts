import { HttpClient } from './http-client';
import {
  SigAgentConfig,
  ListOrganizationsResponse,
  Organization,
  LLMChatRequest,
  LLMChatResponse,
  LLMChatStreamChunk,
  LLMChatStreamError,
} from './types';

/**
 * SigAgent - Base client for browser applications with JWT tokens
 * Use this for browser applications that need to work with JWT tokens
 */
export class SigAgent {
  private http: HttpClient;

  constructor(config: SigAgentConfig) {
    this.http = new HttpClient({
      baseURL: config.baseURL,
      token: config.token,
      tokenProvider: config.tokenProvider,
      timeout: config.timeout,
      retries: config.retries,
      onAuthError: config.onAuthError,
    });
  }

  /**
   * Update the token
   */
  updateToken(token: string): void {
    this.http.updateToken(token);
  }

  /**
   * Organizations API
   */
  public readonly organizations = {
    /**
     * List organizations
     */
    list: async (): Promise<ListOrganizationsResponse> => {
      return this.http.get<ListOrganizationsResponse>('/organizations');
    },

    /**
     * Get organization details
     */
    get: async (id: string): Promise<Organization> => {
      return this.http.get<Organization>(`/organizations/${id}`);
    },
  };

  /**
   * LLM API
   */
  public readonly llm = {
    /**
     * Run LLM chat
     */
    chat: async (request: LLMChatRequest): Promise<LLMChatResponse> => {
      return this.http.post<LLMChatResponse>('/llm/chat', request);
    },

    /**
     * Run LLM chat with streaming
     */
    chatStream: async (
      request: LLMChatRequest,
      onChunk: (chunk: LLMChatStreamChunk | LLMChatStreamError) => void,
      onError?: (error: Error) => void,
      abortSignal?: AbortSignal
    ): Promise<void> => {
      return this.http.stream('/llm/chat/stream', request, onChunk, onError, abortSignal);
    },
  };
}
