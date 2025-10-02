import { HttpClient } from './http-client';
import { DocRouterConfig } from './types';
import { DocumentsAPI } from './modules/documents';
import { OrganizationsAPI } from './modules/organizations';
import { LLMAPI } from './modules/llm';
import { TokensAPI } from './modules/tokens';
import { UsersAPI } from './modules/users';
import { OCRAPI } from './modules/ocr';
import { TagsAPI } from './modules/tags';

/**
 * DocRouter - General purpose client that can work with JWT tokens or any bearer token
 * Use this for browser applications or when you have a JWT token
 */
export class DocRouter {
  public readonly documents: DocumentsAPI;
  public readonly organizations: OrganizationsAPI;
  public readonly llm: LLMAPI;
  public readonly tokens: TokensAPI;
  public readonly users: UsersAPI;
  public readonly ocr: OCRAPI;
  public readonly tags: TagsAPI;
  private http: HttpClient;

  constructor(config: DocRouterConfig) {
    this.http = new HttpClient({
      baseURL: config.baseURL,
      token: config.token,
      tokenProvider: config.tokenProvider,
      timeout: config.timeout,
      retries: config.retries,
      onAuthError: config.onAuthError,
    });

    this.documents = new DocumentsAPI(this.http);
    this.organizations = new OrganizationsAPI(this.http);
    this.llm = new LLMAPI(this.http);
    this.tokens = new TokensAPI(this.http);
    this.users = new UsersAPI(this.http);
    this.ocr = new OCRAPI(this.http);
    this.tags = new TagsAPI(this.http);
  }

  /**
   * Update the token
   */
  updateToken(token: string): void {
    this.http.updateToken(token);
  }

  /**
   * Update the token provider
   */
  updateTokenProvider(provider: () => Promise<string>): void {
    this.http.updateTokenProvider(provider);
  }

  /**
   * Get the current HTTP client (for advanced usage)
   */
  getHttpClient(): HttpClient {
    return this.http;
  }
}
