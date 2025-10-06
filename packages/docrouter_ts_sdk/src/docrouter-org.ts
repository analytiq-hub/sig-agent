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

  async upload(params: Omit<import('./types').UploadDocumentsParams, 'organizationId'>) {
    return super.upload({ ...params, organizationId: this.orgId });
  }

  async list(params?: Omit<ListDocumentsParams, 'organizationId'>) {
    return super.list({ ...params, organizationId: this.orgId });
  }

  async get(params: Omit<import('./types').GetDocumentParams, 'organizationId'>) {
    return super.get({ ...params, organizationId: this.orgId });
  }

  async update(params: Omit<import('./types').UpdateDocumentParams, 'organizationId'>) {
    return super.update({ ...params, organizationId: this.orgId });
  }

  async delete(params: Omit<import('./types').DeleteDocumentParams, 'organizationId'>) {
    return super.delete({ ...params, organizationId: this.orgId });
  }
}

/**
 * Organization-scoped TagsAPI wrapper that automatically injects organizationId
 */
class OrgTagsAPI extends TagsAPI {
  constructor(http: HttpClient, private orgId: string) {
    super(http);
  }

  async create(params: Omit<import('./types').CreateTagParams, 'organizationId'>) {
    return super.create({ ...params, organizationId: this.orgId });
  }

  async get(params: Omit<{ organizationId: string; tagId: string }, 'organizationId'>) {
    return super.get({ ...params, organizationId: this.orgId });
  }

  async list(params?: Omit<import('./types').ListTagsParams, 'organizationId'>) {
    return super.list({ ...params, organizationId: this.orgId });
  }

  async update(params: Omit<import('./types').UpdateTagParams, 'organizationId'>) {
    return super.update({ ...params, organizationId: this.orgId });
  }

  async delete(params: Omit<import('./types').DeleteTagParams, 'organizationId'>) {
    return super.delete({ ...params, organizationId: this.orgId });
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
  public readonly tags: OrgTagsAPI;
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
    this.tags = new OrgTagsAPI(this.http, this.organizationId);
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
