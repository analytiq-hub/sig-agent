// Core SDK types
export interface DocRouterConfig {
  baseURL: string;
  token?: string;
  tokenProvider?: () => Promise<string>;
  timeout?: number;
  retries?: number;
  onAuthError?: (error: Error) => void;
}

export interface DocRouterAccountConfig {
  baseURL: string;
  accountToken: string;
  timeout?: number;
  retries?: number;
  onAuthError?: (error: Error) => void;
}

export interface DocRouterOrgConfig {
  baseURL: string;
  orgToken: string;
  organizationId: string;
  timeout?: number;
  retries?: number;
  onAuthError?: (error: Error) => void;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

// Auth types
export interface CreateTokenRequest {
  name: string;
  lifetime: number;
}

export interface AccessToken {
  id: string;
  user_id: string;
  organization_id?: string;
  name: string;
  token: string;
  created_at: string;
  lifetime: number;
}

export interface ListAccessTokensResponse {
  access_tokens: AccessToken[];
}

// Organization types
export interface OrganizationMember {
  user_id: string;
  role: 'admin' | 'user';
}

export type OrganizationType = 'individual' | 'team' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  members: OrganizationMember[];
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationRequest {
  name: string;
  type?: OrganizationType;
}

export interface UpdateOrganizationRequest {
  name?: string;
  type?: OrganizationType;
  members?: OrganizationMember[];
}

export interface ListOrganizationsResponse {
  organizations: Organization[];
  total_count: number;
  skip: number;
}

// Document types
export interface Document {
  id: string;
  pdf_id: string;
  document_name: string;
  upload_date: string;
  uploaded_by: string;
  state: string;
  tag_ids: string[];
  type: string;
  metadata: Record<string, string>;
}

export interface UploadDocument {
  name: string;
  content: ArrayBuffer | Buffer | Uint8Array;
  type: string;
  metadata?: Record<string, string>;
}

export interface UploadDocumentsParams {
  documents: UploadDocument[];
}

export interface UploadedDocument {
  document_id: string;
  document_name: string;
  upload_date: string;
  uploaded_by: string;
  state: string;
  tag_ids: string[];
  type?: string;
  metadata: Record<string, string>;
}

export interface UploadDocumentsResponse {
  documents: UploadedDocument[];
}

export interface GetDocumentParams {
  documentId: string;
  fileType: string;
}

export interface GetDocumentResponse {
  id: string;
  pdf_id: string;
  document_name: string;
  upload_date: string;
  uploaded_by: string;
  state: string;
  tag_ids: string[];
  type: string;
  metadata: Record<string, string>;
  content: ArrayBuffer;
}

export interface UpdateDocumentParams {
  documentId: string;
  documentName?: string;
  tagIds?: string[];
  metadata?: Record<string, string>;
}

export interface DeleteDocumentParams {
  documentId: string;
}

export interface ListDocumentsParams {
  skip?: number;
  limit?: number;
  tagIds?: string;
  nameSearch?: string;
  metadataSearch?: string;
}

export interface ListDocumentsResponse {
  documents: Document[];
  total_count: number;
  skip: number;
}

// OCR types
export interface GetOCRBlocksParams {
  documentId: string;
}

export interface GetOCRTextParams {
  documentId: string;
  pageNum?: number;
}

export interface GetOCRMetadataParams {
  documentId: string;
}

export interface GetOCRMetadataResponse {
  document_id: string;
  page_count: number;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

// LLM types
export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMChatRequest {
  messages: LLMChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface LLMChatResponse {
  message: LLMChatMessage;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMChatStreamChunk {
  type: 'chunk';
  content: string;
  done: boolean;
}

export interface LLMChatStreamError {
  type: 'error';
  error: string;
  done: true;
}

export interface ListLLMModelsParams {
  providerName?: string;
  providerEnabled?: boolean;
  llmEnabled?: boolean;
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
}

export interface ListLLMModelsResponse {
  models: LLMModel[];
}

export interface ListLLMProvidersResponse {
  providers: Array<{
    name: string;
    enabled: boolean;
    configured: boolean;
  }>;
}

export interface SetLLMProviderConfigRequest {
  api_key?: string;
  base_url?: string;
  enabled?: boolean;
}

export interface RunLLMParams {
  documentId: string;
  promptRevId: string;
  force?: boolean;
}

export interface RunLLMResponse {
  result_id: string;
  status: string;
}

export interface GetLLMResultParams {
  documentId: string;
  promptRevId: string;
  fallback?: boolean;
}

export interface GetLLMResultResponse {
  result: Record<string, unknown>;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeleteLLMResultParams {
  documentId: string;
  promptId: string;
}

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  email: string;
  name: string;
  password: string;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  password?: string;
}

export interface UserResponse {
  user: User;
}

export interface ListUsersParams {
  skip?: number;
  limit?: number;
  organization_id?: string;
  user_id?: string;
  search_name?: string;
}

export interface ListUsersResponse {
  users: User[];
  total_count: number;
  skip: number;
}

// Tag types
export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTagParams {
  tag: Omit<Tag, 'id' | 'created_at' | 'updated_at'>;
}

export interface ListTagsParams {
  skip?: number;
  limit?: number;
  nameSearch?: string;
}

export interface ListTagsResponse {
  tags: Tag[];
  total_count: number;
  skip: number;
}

export interface UpdateTagParams {
  tagId: string;
  tag: Partial<Omit<Tag, 'id' | 'created_at' | 'updated_at'>>;
}

export interface DeleteTagParams {
  tagId: string;
}

// Payment types
export interface PortalSessionResponse {
  url: string;
}

export interface SubscriptionResponse {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  plan_id: string;
}

export interface UsageResponse {
  credits_used: number;
  credits_remaining: number;
  period_start: string;
  period_end: string;
}

export interface CreditConfig {
  cost_per_credit: number;
  credits_per_dollar: number;
}

export interface CreditUpdateResponse {
  credits_added: number;
  new_balance: number;
}

export interface UsageRangeRequest {
  start_date: string;
  end_date: string;
}

export interface UsageRangeResponse {
  usage: Array<{
    date: string;
    credits_used: number;
  }>;
}

// Form types
export interface Form {
  id: string;
  name: string;
  schema: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateFormParams {
  organizationId: string;
  name: string;
  schema: Record<string, unknown>;
}

export interface ListFormsParams {
  organizationId: string;
  skip?: number;
  limit?: number;
  tag_ids?: string;
}

export interface ListFormsResponse {
  forms: Form[];
  total_count: number;
  skip: number;
}

export interface GetFormParams {
  organizationId: string;
  formRevId: string;
}

export interface UpdateFormParams {
  organizationId: string;
  formId: string;
  form: Partial<Omit<Form, 'id' | 'created_at' | 'updated_at'>>;
}

export interface DeleteFormParams {
  organizationId: string;
  formId: string;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  document_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SubmitFormParams {
  organizationId: string;
  documentId: string;
  submission: Record<string, unknown>;
}

export interface GetFormSubmissionParams {
  organizationId: string;
  documentId: string;
  formRevId: string;
}

export interface DeleteFormSubmissionParams {
  organizationId: string;
  documentId: string;
  formRevId: string;
}

// Prompt types
export interface Prompt {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePromptParams {
  organizationId: string;
  prompt: Omit<Prompt, 'id' | 'created_at' | 'updated_at'>;
}

export interface ListPromptsParams {
  organizationId: string;
  skip?: number;
  limit?: number;
  document_id?: string;
  tag_ids?: string;
  nameSearch?: string;
}

export interface ListPromptsResponse {
  prompts: Prompt[];
  total_count: number;
  skip: number;
}

export interface GetPromptParams {
  organizationId: string;
  promptRevId: string;
}

export interface UpdatePromptParams {
  organizationId: string;
  promptId: string;
  prompt: Partial<Omit<Prompt, 'id' | 'created_at' | 'updated_at'>>;
}

export interface DeletePromptParams {
  organizationId: string;
  promptId: string;
}

// Flow types
export interface Flow {
  id: string;
  name: string;
  definition: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateFlowParams {
  organizationId: string;
  flow: Omit<Flow, 'id' | 'created_at' | 'updated_at'>;
}

export interface UpdateFlowParams {
  organizationId: string;
  flowId: string;
  flow: Partial<Omit<Flow, 'id' | 'created_at' | 'updated_at'>>;
}

export interface ListFlowsParams {
  organizationId: string;
  skip?: number;
  limit?: number;
}

export interface ListFlowsResponse {
  flows: Flow[];
  total_count: number;
  skip: number;
}

export interface GetFlowParams {
  organizationId: string;
  flowId: string;
}

export interface DeleteFlowParams {
  organizationId: string;
  flowId: string;
}

// Schema types
export interface Schema {
  id: string;
  name: string;
  schema: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateSchemaParams {
  organizationId: string;
  name: string;
  schema: Record<string, unknown>;
}

export interface ListSchemasParams {
  organizationId: string;
  skip?: number;
  limit?: number;
  nameSearch?: string;
}

export interface ListSchemasResponse {
  schemas: Schema[];
  total_count: number;
  skip: number;
}

export interface GetSchemaParams {
  organizationId: string;
  schemaRevId: string;
}

export interface UpdateSchemaParams {
  organizationId: string;
  schemaId: string;
  schema: Partial<Omit<Schema, 'id' | 'created_at' | 'updated_at'>>;
}

export interface DeleteSchemaParams {
  organizationId: string;
  schemaId: string;
}

// Invitation types
export interface InvitationResponse {
  id: string;
  email: string;
  organization_id: string;
  role: string;
  created_at: string;
  expires_at: string;
}

export interface CreateInvitationRequest {
  email: string;
  organization_id: string;
  role: string;
}

export interface ListInvitationsParams {
  skip?: number;
  limit?: number;
}

export interface ListInvitationsResponse {
  invitations: InvitationResponse[];
  total_count: number;
  skip: number;
}

export interface AcceptInvitationRequest {
  name: string;
  password: string;
}

// AWS Config types
export interface AWSConfig {
  access_key_id: string;
  secret_access_key: string;
  region: string;
  created_at: string;
}
