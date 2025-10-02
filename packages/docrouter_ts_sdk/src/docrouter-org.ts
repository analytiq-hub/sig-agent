import { HttpClient } from './http-client';
import { DocRouterOrgConfig } from './types';
import { DocumentsAPI } from './modules/documents';
import { LLMAPI } from './modules/llm';
import { OCRAPI } from './modules/ocr';
import { TagsAPI } from './modules/tags';

/**
 * DocRouterOrg - For organization-scoped operations with org tokens
 * Use this when you have an organization token and want to work within that org
 */
export class DocRouterOrg {
  public readonly documents: DocumentsAPI;
  public readonly llm: LLMAPI;
  public readonly ocr: OCRAPI;
  public readonly tags: TagsAPI;
  public readonly organizationId: string;
  private http: HttpClient;

  constructor(config: DocRouterOrgConfig) {
    this.organizationId = config.organizationId;
    this.http = new HttpClient({
      baseURL: config.baseURL,
      token: config.orgToken,
      timeout: config.timeout,
      retries: config.retries,
      onAuthError: config.onAuthError,
    });

    this.documents = new DocumentsAPI(this.http);
    this.llm = new LLMAPI(this.http);
    this.ocr = new OCRAPI(this.http);
    this.tags = new TagsAPI(this.http);
  }

  /**
   * Update the organization token
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
