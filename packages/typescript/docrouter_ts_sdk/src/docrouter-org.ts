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
  // Forms
  CreateFormParams,
  ListFormsParams,
  ListFormsResponse,
  GetFormParams,
  UpdateFormParams,
  DeleteFormParams,
  SubmitFormParams,
  GetFormSubmissionParams,
  DeleteFormSubmissionParams,
  Form,
  FormSubmission,
  // Prompts
  CreatePromptParams,
  ListPromptsParams,
  ListPromptsResponse,
  GetPromptParams,
  UpdatePromptParams,
  DeletePromptParams,
  Prompt,
  // Schemas
  CreateSchemaParams,
  ListSchemasParams,
  ListSchemasResponse,
  GetSchemaParams,
  UpdateSchemaParams,
  DeleteSchemaParams,
  Schema,
  // Flows
  CreateFlowParams,
  ListFlowsParams,
  ListFlowsResponse,
  GetFlowParams,
  UpdateFlowParams,
  DeleteFlowParams,
  Flow,
  // Payments
  PortalSessionResponse,
  SubscriptionResponse,
  UsageResponse,
  CreditConfig,
  CreditUpdateResponse,
  UsageRangeRequest,
  UsageRangeResponse,
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

  // ---------------- Forms ----------------

  async createForm(form: Omit<CreateFormParams, 'organizationId'>): Promise<Form> {
    const { name, response_format } = form;
    return this.http.post<Form>(`/v0/orgs/${this.organizationId}/forms`, { name, response_format });
  }

  async listForms(params?: Omit<ListFormsParams, 'organizationId'>): Promise<ListFormsResponse> {
    const { skip, limit, tag_ids } = params || {} as any;
    return this.http.get<ListFormsResponse>(`/v0/orgs/${this.organizationId}/forms`, {
      params: { skip: skip || 0, limit: limit || 10, tag_ids }
    });
  }

  async getForm(params: Omit<GetFormParams, 'organizationId'>): Promise<Form> {
    const { formRevId } = params;
    return this.http.get<Form>(`/v0/orgs/${this.organizationId}/forms/${formRevId}`);
  }

  async updateForm(params: Omit<UpdateFormParams, 'organizationId'>): Promise<Form> {
    const { formId, form } = params;
    return this.http.put<Form>(`/v0/orgs/${this.organizationId}/forms/${formId}`, form);
  }

  async deleteForm(params: Omit<DeleteFormParams, 'organizationId'>): Promise<void> {
    const { formId } = params;
    await this.http.delete(`/v0/orgs/${this.organizationId}/forms/${formId}`);
  }

  async submitForm(params: Omit<SubmitFormParams, 'organizationId'>): Promise<FormSubmission> {
    const { documentId, formRevId, submission_data, submitted_by } = params;
    return this.http.post<FormSubmission>(`/v0/orgs/${this.organizationId}/forms/submissions/${documentId}`, {
      form_revid: formRevId,
      submission_data: submission_data,
      submitted_by: submitted_by
    });
  }

  async getFormSubmission(params: Omit<GetFormSubmissionParams, 'organizationId'>): Promise<FormSubmission | null> {
    const { documentId, formRevId } = params;
    return this.http.get<FormSubmission | null>(`/v0/orgs/${this.organizationId}/forms/submissions/${documentId}?form_revid=${formRevId}`);
  }

  async deleteFormSubmission(params: Omit<DeleteFormSubmissionParams, 'organizationId'>): Promise<void> {
    const { documentId, formRevId } = params;
    await this.http.delete(`/v0/orgs/${this.organizationId}/forms/submissions/${documentId}`, { params: { form_revid: formRevId } });
  }

  // ---------------- Prompts ----------------

  async createPrompt(params: Omit<CreatePromptParams, 'organizationId'>): Promise<Prompt> {
    const { prompt } = params;
    return this.http.post<Prompt>(`/v0/orgs/${this.organizationId}/prompts`, prompt);
  }

  async listPrompts(params: Omit<ListPromptsParams, 'organizationId'>): Promise<ListPromptsResponse> {
    const { skip, limit, document_id, tag_ids, nameSearch } = params || {} as any;
    return this.http.get<ListPromptsResponse>(`/v0/orgs/${this.organizationId}/prompts`, {
      params: {
        skip: skip || 0,
        limit: limit || 10,
        document_id,
        tag_ids,
        name_search: nameSearch
      }
    });
  }

  async getPrompt(params: Omit<GetPromptParams, 'organizationId'>): Promise<Prompt> {
    const { promptRevId } = params;
    return this.http.get<Prompt>(`/v0/orgs/${this.organizationId}/prompts/${promptRevId}`);
  }

  async updatePrompt(params: Omit<UpdatePromptParams, 'organizationId'>): Promise<Prompt> {
    const { promptId, prompt } = params;
    return this.http.put<Prompt>(`/v0/orgs/${this.organizationId}/prompts/${promptId}`, prompt);
  }

  async deletePrompt(params: Omit<DeletePromptParams, 'organizationId'>): Promise<void> {
    const { promptId } = params;
    await this.http.delete(`/v0/orgs/${this.organizationId}/prompts/${promptId}`);
  }

  // ---------------- Schemas ----------------

  async createSchema(schema: Omit<CreateSchemaParams, 'organizationId'>): Promise<Schema> {
    return this.http.post<Schema>(`/v0/orgs/${this.organizationId}/schemas`, schema);
  }

  async listSchemas(params: Omit<ListSchemasParams, 'organizationId'>): Promise<ListSchemasResponse> {
    const { skip, limit, nameSearch } = params || {} as any;
    return this.http.get<ListSchemasResponse>(`/v0/orgs/${this.organizationId}/schemas`, {
      params: { skip: skip || 0, limit: limit || 10, name_search: nameSearch }
    });
  }

  async getSchema(params: Omit<GetSchemaParams, 'organizationId'>): Promise<Schema> {
    const { schemaRevId } = params;
    return this.http.get<Schema>(`/v0/orgs/${this.organizationId}/schemas/${schemaRevId}`);
  }

  async updateSchema(params: Omit<UpdateSchemaParams, 'organizationId'>): Promise<Schema> {
    const { schemaId, schema } = params;
    return this.http.put<Schema>(`/v0/orgs/${this.organizationId}/schemas/${schemaId}`, schema);
  }

  async deleteSchema(params: Omit<DeleteSchemaParams, 'organizationId'>): Promise<void> {
    const { schemaId } = params;
    await this.http.delete(`/v0/orgs/${this.organizationId}/schemas/${schemaId}`);
  }

  async validateAgainstSchema(params: { schemaRevId: string; data: Record<string, unknown> }): Promise<{ valid: boolean; errors?: string[] }> {
    const { schemaRevId, data } = params;
    return this.http.post<{ valid: boolean; errors?: string[] }>(`/v0/orgs/${this.organizationId}/schemas/${schemaRevId}/validate`, { data });
  }

  // ---------------- Flows ----------------

  async createFlow(params: Omit<CreateFlowParams, 'organizationId'>): Promise<Flow> {
    const { flow } = params;
    return this.http.post<Flow>(`/v0/orgs/${this.organizationId}/flows`, flow);
  }

  async updateFlow(params: Omit<UpdateFlowParams, 'organizationId'>): Promise<Flow> {
    const { flowId, flow } = params;
    return this.http.put<Flow>(`/v0/orgs/${this.organizationId}/flows/${flowId}`, flow);
  }

  async listFlows(params?: Omit<ListFlowsParams, 'organizationId'>): Promise<ListFlowsResponse> {
    const { skip, limit } = params || {} as any;
    return this.http.get<ListFlowsResponse>(`/v0/orgs/${this.organizationId}/flows`, {
      params: { skip: skip || 0, limit: limit || 10 }
    });
  }

  async getFlow(params: Omit<GetFlowParams, 'organizationId'>): Promise<Flow> {
    const { flowId } = params;
    return this.http.get<Flow>(`/v0/orgs/${this.organizationId}/flows/${flowId}`);
  }

  async deleteFlow(params: Omit<DeleteFlowParams, 'organizationId'>): Promise<void> {
    const { flowId } = params;
    await this.http.delete(`/v0/orgs/${this.organizationId}/flows/${flowId}`);
  }

  // ---------------- Payments ----------------

  async getCustomerPortal(): Promise<PortalSessionResponse> {
    return this.http.post<PortalSessionResponse>(`/v0/orgs/${this.organizationId}/payments/customer-portal`, {});
  }

  async getSubscription(): Promise<SubscriptionResponse> {
    return this.http.get<SubscriptionResponse>(`/v0/orgs/${this.organizationId}/payments/subscription`);
  }

  async activateSubscription(): Promise<{ status: string; message: string }> {
    return this.http.put<{ status: string; message: string }>(`/v0/orgs/${this.organizationId}/payments/subscription`, {});
  }

  async cancelSubscription(): Promise<{ status: string; message: string }> {
    return this.http.delete<{ status: string; message: string }>(`/v0/orgs/${this.organizationId}/payments/subscription`);
  }


  async getCurrentUsage(): Promise<UsageResponse> {
    return this.http.get<UsageResponse>(`/v0/orgs/${this.organizationId}/payments/usage`);
  }

  async addCredits(amount: number): Promise<CreditUpdateResponse> {
    return this.http.post<CreditUpdateResponse>(`/v0/orgs/${this.organizationId}/payments/credits/add`, { amount });
  }

  async getCreditConfig(): Promise<CreditConfig> {
    return this.http.get<CreditConfig>(`/v0/orgs/${this.organizationId}/payments/credits/config`);
  }

  async purchaseCredits(request: { credits: number; success_url: string; cancel_url: string; }) {
    return this.http.post(`/v0/orgs/${this.organizationId}/payments/credits/purchase`, request);
  }

  async getUsageRange(request: UsageRangeRequest): Promise<UsageRangeResponse> {
    return this.http.get<UsageRangeResponse>(`/v0/orgs/${this.organizationId}/payments/usage/range`, { params: request });
  }

  async createCheckoutSession(planId: string): Promise<PortalSessionResponse> {
    return this.http.post<PortalSessionResponse>(`/v0/orgs/${this.organizationId}/payments/checkout-session`, { plan_id: planId });
  }

  // ---------------- LLM Chat (Org) ----------------

  async runLLMChat(request: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; model?: string; temperature?: number; max_tokens?: number; stream?: boolean; }) {
    return this.http.post(`/v0/orgs/${this.organizationId}/llm/run`, request);
  }

  async runLLMChatStream(
    request: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; model?: string; temperature?: number; max_tokens?: number; stream?: boolean; },
    onChunk: (chunk: unknown) => void,
    onError?: (error: Error) => void,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const streamingRequest = { ...request, stream: true };
    return this.http.stream(`/v0/orgs/${this.organizationId}/llm/run`, streamingRequest, onChunk, onError, abortSignal);
  }

  /**
   * Get the current HTTP client (for advanced usage)
   */
  getHttpClient(): HttpClient {
    return this.http;
  }
}
