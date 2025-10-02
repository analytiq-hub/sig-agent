import { HttpClient } from './http-client';
import { DocRouterAccountConfig } from './types';
import { OrganizationsAPI } from './modules/organizations';
import { LLMAPI } from './modules/llm';
import { TokensAPI } from './modules/tokens';
import { UsersAPI } from './modules/users';

/**
 * DocRouterAccount - For account-level operations with account tokens
 * Use this for server-to-server integrations that need full account access
 */
export class DocRouterAccount {
  public readonly organizations: OrganizationsAPI;
  public readonly llm: LLMAPI;
  public readonly tokens: TokensAPI;
  public readonly users: UsersAPI;
  private http: HttpClient;

  constructor(config: DocRouterAccountConfig) {
    this.http = new HttpClient({
      baseURL: config.baseURL,
      token: config.accountToken,
      timeout: config.timeout,
      retries: config.retries,
      onAuthError: config.onAuthError,
    });

    this.organizations = new OrganizationsAPI(this.http);
    this.llm = new LLMAPI(this.http);
    this.tokens = new TokensAPI(this.http);
    this.users = new UsersAPI(this.http);
  }

  /**
   * Update the account token
   */
  updateToken(token: string): void {
    this.http.updateToken(token);
  }

  /**
   * Get the current HTTP client (for advanced usage)
   */
  getHttpClient(): HttpClient {
    return this.http;
  }
}
