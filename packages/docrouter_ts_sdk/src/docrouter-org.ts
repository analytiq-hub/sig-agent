import { HttpClient } from './http-client';
import { DocRouterOrgConfig, ListDocumentsParams } from './types';
import { DocumentsAPI } from './modules/documents';
import { LLMAPI } from './modules/llm';
import { OCRAPI } from './modules/ocr';
import { TagsAPI } from './modules/tags';

/**
 * Organization-scoped DocumentsAPI wrapper that automatically injects organizationId
 */
class OrgDocumentsAPI extends DocumentsAPI {
  constructor(http: HttpClient, private orgId: string) {
    super(http);
  }

  async list(params?: Omit<ListDocumentsParams, 'organizationId'>) {
    return super.list({ ...params, organizationId: this.orgId });
  }
}

/**
 * DocRouterOrg - For organization-scoped operations with org tokens
 * Use this when you have an organization token and want to work within that org
 */
export class DocRouterOrg {
  public readonly documents: OrgDocumentsAPI;
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

    this.documents = new OrgDocumentsAPI(this.http, this.organizationId);
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
