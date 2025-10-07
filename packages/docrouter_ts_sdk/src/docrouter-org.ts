import { HttpClient } from './http-client';
import {
  DocRouterOrgConfig,
  UploadDocumentsResponse,
  ListDocumentsResponse,
  GetDocumentResponse,
  GetOCRMetadataResponse,
  RunLLMResponse,
  GetLLMResultResponse,
  ListTagsResponse,
  Tag,
} from './types';

/**
 * DocRouterOrg - For organization-scoped operations with org tokens
 * Use this when you have an organization token and want to work within that org
 */
export class DocRouterOrg {
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
  }

  /**
   * Update the organization token
   */
  updateToken(token: string): void {
    this.http.updateToken(token);
  }

  // ---------------- Documents ----------------

  async uploadDocuments(params: { documents: Array<{ name: string; content: ArrayBuffer | Buffer | Uint8Array; type: string; metadata?: Record<string, string>; }>; }): Promise<UploadDocumentsResponse> {
    const documentsPayload = params.documents.map(doc => {
      let base64Content: string;
      if (doc.content instanceof ArrayBuffer) {
        const buffer = Buffer.from(doc.content);
        base64Content = buffer.toString('base64');
      } else if (doc.content instanceof Buffer) {
        base64Content = doc.content.toString('base64');
      } else if (doc.content instanceof Uint8Array) {
        const buffer = Buffer.from(doc.content);
        base64Content = buffer.toString('base64');
      } else {
        const buffer = Buffer.from(doc.content as any);
        base64Content = buffer.toString('base64');
      }

      const payload: any = {
        name: doc.name,
        content: base64Content,
      };
      if (doc.metadata) payload.metadata = doc.metadata;
      return payload;
    });

    return this.http.post<UploadDocumentsResponse>(
      `/v0/orgs/${this.organizationId}/documents`,
      { documents: documentsPayload }
    );
  }

  async listDocuments(params?: { skip?: number; limit?: number; tagIds?: string; nameSearch?: string; metadataSearch?: string; }): Promise<ListDocumentsResponse> {
    const queryParams: Record<string, string | number | undefined> = {
      skip: params?.skip || 0,
      limit: params?.limit || 10,
    };
    if (params?.tagIds) queryParams.tag_ids = params.tagIds;
    if (params?.nameSearch) queryParams.name_search = params.nameSearch;
    if (params?.metadataSearch) queryParams.metadata_search = params.metadataSearch;

    return this.http.get<ListDocumentsResponse>(`/v0/orgs/${this.organizationId}/documents`, {
      params: queryParams
    });
  }

  async getDocument(params: { documentId: string; fileType: string; }): Promise<GetDocumentResponse> {
    const { documentId, fileType } = params;
    const response = await this.http.get<{
      id: string;
      pdf_id: string;
      document_name: string;
      upload_date: string;
      uploaded_by: string;
      state: string;
      tag_ids: string[];
      type: string;
      metadata: Record<string, string>;
      content: string;
    }>(`/v0/orgs/${this.organizationId}/documents/${documentId}?file_type=${fileType}`);

    const binaryContent = atob(response.content);
    const len = binaryContent.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryContent.charCodeAt(i);
    }

    return {
      id: response.id,
      pdf_id: response.pdf_id,
      document_name: response.document_name,
      upload_date: response.upload_date,
      uploaded_by: response.uploaded_by,
      state: response.state,
      tag_ids: response.tag_ids,
      type: response.type,
      metadata: response.metadata,
      content: bytes.buffer
    };
  }

  async updateDocument(params: { documentId: string; documentName?: string; tagIds?: string[]; metadata?: Record<string, string>; }) {
    const { documentId, documentName, tagIds, metadata } = params;
    const updateData: { tag_ids?: string[]; document_name?: string; metadata?: Record<string, string> } = {};
    if (documentName !== undefined) updateData.document_name = documentName;
    if (tagIds !== undefined) updateData.tag_ids = tagIds;
    if (metadata !== undefined) updateData.metadata = metadata;
    return this.http.put(`/v0/orgs/${this.organizationId}/documents/${documentId}`, updateData);
  }

  async deleteDocument(params: { documentId: string; }) {
    const { documentId } = params;
    return this.http.delete(`/v0/orgs/${this.organizationId}/documents/${documentId}`);
  }

  // ---------------- OCR ----------------

  async getOCRBlocks(params: { documentId: string; }) {
    const { documentId } = params;
    return this.http.get(`/v0/orgs/${this.organizationId}/ocr/download/blocks/${documentId}`);
  }

  async getOCRText(params: { documentId: string; pageNum?: number; }) {
    const { documentId, pageNum } = params;
    const url = `/v0/orgs/${this.organizationId}/ocr/download/text/${documentId}${pageNum ? `?page_num=${pageNum}` : ''}`;
    return this.http.get(url);
  }

  async getOCRMetadata(params: { documentId: string; }): Promise<GetOCRMetadataResponse> {
    const { documentId } = params;
    return this.http.get<GetOCRMetadataResponse>(`/v0/orgs/${this.organizationId}/ocr/download/metadata/${documentId}`);
  }

  // ---------------- LLM ----------------

  async runLLM(params: { documentId: string; promptRevId: string; force?: boolean; }): Promise<RunLLMResponse> {
    const { documentId, promptRevId, force } = params;
    return this.http.post<RunLLMResponse>(
      `/v0/orgs/${this.organizationId}/llm/run/${documentId}`,
      {},
      { params: { prompt_revid: promptRevId, force } }
    );
  }

  async getLLMResult(params: { documentId: string; promptRevId: string; fallback?: boolean; }): Promise<GetLLMResultResponse> {
    const { documentId, promptRevId, fallback } = params;
    return this.http.get<GetLLMResultResponse>(
      `/v0/orgs/${this.organizationId}/llm/result/${documentId}`,
      { params: { prompt_revid: promptRevId, fallback } }
    );
  }

  async updateLLMResult({
    documentId,
    promptId,
    result,
    isVerified = false
  }: { documentId: string; promptId: string; result: Record<string, unknown>; isVerified?: boolean; }) {
    const response = await this.http.put<{
      status: number;
      data: unknown;
    }>(
      `/v0/orgs/${this.organizationId}/llm/result/${documentId}`,
      { updated_llm_result: result, is_verified: isVerified },
      { params: { prompt_revid: promptId } }
    );
    if (response.status !== 200) {
      throw new Error(`Failed to update LLM result for document ${documentId} and prompt ${promptId}: ${response.data}`);
    }
    return response.data;
  }

  async deleteLLMResult(params: { documentId: string; promptId: string; }) {
    const { documentId, promptId } = params;
    return this.http.delete(
      `/v0/orgs/${this.organizationId}/llm/result/${documentId}`,
      { params: { prompt_revid: promptId } }
    );
  }

  async downloadAllLLMResults(params: { documentId: string; }) {
    const { documentId } = params;
    return this.http.get(
      `/v0/orgs/${this.organizationId}/llm/results/${documentId}/download`,
      { responseType: 'blob' as any }
    );
  }

  // ---------------- Tags ----------------

  async createTag(params: { tag: Omit<Tag, 'id' | 'created_at' | 'updated_at'>; }): Promise<Tag> {
    const { tag } = params;
    return this.http.post<Tag>(`/v0/orgs/${this.organizationId}/tags`, tag);
  }

  async getTag({ tagId }: { tagId: string; }): Promise<Tag> {
    return this.http.get<Tag>(`/v0/orgs/${this.organizationId}/tags/${tagId}`);
  }

  async listTags(params?: { skip?: number; limit?: number; nameSearch?: string; }): Promise<ListTagsResponse> {
    const { skip, limit, nameSearch } = params || {} as any;
    return this.http.get<ListTagsResponse>(`/v0/orgs/${this.organizationId}/tags`, {
      params: { skip: skip || 0, limit: limit || 10, name_search: nameSearch }
    });
  }

  async updateTag(params: { tagId: string; tag: Partial<Omit<Tag, 'id' | 'created_at' | 'updated_at'>>; }): Promise<Tag> {
    const { tagId, tag } = params;
    return this.http.put<Tag>(`/v0/orgs/${this.organizationId}/tags/${tagId}`, tag);
  }

  async deleteTag(params: { tagId: string; }): Promise<void> {
    const { tagId } = params;
    await this.http.delete(`/v0/orgs/${this.organizationId}/tags/${tagId}`);
  }

  /**
   * Get the current HTTP client (for advanced usage)
   */
  getHttpClient(): HttpClient {
    return this.http;
  }
}
