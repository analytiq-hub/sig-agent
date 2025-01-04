import axios, { isAxiosError } from 'axios';
import { getSession } from 'next-auth/react';
import { AppSession } from '@/app/types/AppSession';
import { CreateOrganizationRequest, ListOrganizationsResponse, Organization, UpdateOrganizationRequest, ListUsersParams } from '@/app/types/Api';
import { toast } from 'react-hot-toast';

// These APIs execute from the frontend
const NEXT_PUBLIC_FASTAPI_FRONTEND_URL = process.env.NEXT_PUBLIC_FASTAPI_FRONTEND_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: NEXT_PUBLIC_FASTAPI_FRONTEND_URL, 
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add authorization header to all requests
api.interceptors.request.use(async (config) => {
  const session = await getSession() as AppSession | null;
  if (session?.apiAccessToken) {
    config.headers.Authorization = `Bearer ${session.apiAccessToken}`;
  } else {
    console.warn('No API token found in session');
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add a request queue to handle concurrent requests during token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Add a response interceptor that handles all errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch(() => {
            // Only show session expiration toast once
            toast.error('Your session has expired. Please login again.', {
              id: 'session-expired', // This ensures only one toast is shown
            });
            setTimeout(() => {
              window.location.href = '/api/auth/signin';
            }, 2000);
            return Promise.reject(new Error('Session expired'));
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const session = await getSession() as AppSession;
        if (session?.apiAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${session.apiAccessToken}`;
          processQueue();
          return api(originalRequest);
        } else {
          toast.error('Your session has expired. Please login again.', {
            id: 'session-expired',
          });
          setTimeout(() => {
            window.location.href = '/api/auth/signin';
          }, 2000);
          return Promise.reject(new Error('Session expired'));
        }
      } catch (refreshError) {
        processQueue(refreshError instanceof Error ? refreshError : new Error('Token refresh failed'));
        toast.error('Your session has expired. Please login again.', {
          id: 'session-expired',
        });
        setTimeout(() => {
          window.location.href = '/api/auth/signin';
        }, 2000);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // For all other errors, just pass through the error without showing toast
    if (isAxiosError(error)) {
      const responseData = error.response?.data as { detail?: string };
      if (responseData?.detail) {
        return Promise.reject(new Error(responseData.detail));
      }
    }

    return Promise.reject(error);
  }
);

// Document APIs

export interface DocumentWithContent {
    name: string;
    content: string;
    tag_ids?: string[];  // Optional list of tag IDs
}

export interface UploadDocumentsResponse {
  uploaded_documents: Array<{
    document_name: string;
    document_id: string;
  }>;
}

export const uploadDocumentsApi = async (documents: DocumentWithContent[]): Promise<UploadDocumentsResponse> => {
  const response = await api.post<UploadDocumentsResponse>('/documents', { files: documents });
  return response.data;
};

export interface UploadedDocument {
    document_name: string;
    document_id: string;
}

export interface DocumentMetadata {
    id: string;
    document_name: string;
    upload_date: string;
    uploaded_by: string;
    state: string;
    tag_ids: string[];  // List of tag IDs
}

export interface ListDocumentsResponse {
    documents: DocumentMetadata[];
    total_count: number;
    skip: number;
}

interface ListDocumentsParams {
  skip?: number;
  limit?: number;
  tag_ids?: string;  // Added tag_ids parameter for filtering
}

export const listDocumentsApi = async (params?: ListDocumentsParams) => {
  const response = await api.get('/documents', { 
    params: {
      skip: params?.skip || 0,
      limit: params?.limit || 10,
      tag_ids: params?.tag_ids
    }
  });
  return response.data;
};

export interface GetDocumentResponse {
  metadata: DocumentMetadata;
  content: ArrayBuffer;
}

export const getDocumentApi = async (id: string): Promise<GetDocumentResponse> => {
  const response = await api.get(`/documents/${id}`);
  const data = response.data;
  
  // Convert base64 content back to ArrayBuffer
  const binaryContent = atob(data.content);
  const len = binaryContent.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryContent.charCodeAt(i);
  }

  return {
    metadata: data.metadata,
    content: bytes.buffer
  };
};

export interface DocumentUpdate {
  tag_ids: string[];
}

export const updateDocumentApi = async (documentId: string, update: DocumentUpdate) => {
  const response = await api.put(`/documents/${documentId}`, update);
  return response.data;
};

export const deleteDocumentApi = async (id: string) => {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
};

// Token APIs

export interface CreateTokenRequest {
  name: string;
  lifetime: number;
}

export const createTokenApi = async (token: CreateTokenRequest) => {
  const response = await api.post('/access_tokens', token);
  return response.data;
};

// A more consistent name for this function would be getAccessTokensApi, but that is too repetitive
export const getTokensApi = async () => {
  const response = await api.get('/access_tokens');
  return response.data;
};

export const deleteTokenApi = async (tokenId: string) => {
  const response = await api.delete(`/access_tokens/${tokenId}`);
  return response.data;
};

export interface CreateLLMTokenRequest {
  llm_vendor: 'OpenAI' | 'Anthropic' | 'Groq';
  token: string;
}

export interface LLMToken {
  id: string;
  user_id: string;
  llm_vendor: 'OpenAI' | 'Anthropic' | 'Groq';
  token: string;
  created_at: string;
}

export const createLLMTokenApi = async (tokenRequest: CreateLLMTokenRequest) => {
  const response = await api.post('/account/llm_tokens', tokenRequest);
  return response.data;
};

export const getLLMTokensApi = async () => {
  const response = await api.get('/account/llm_tokens');
  return response.data;
};

export const deleteLLMTokenApi = async (tokenId: string) => {
  const response = await api.delete(`/account/llm_tokens/${tokenId}`);
  return response.data;
};

// AWS APIs
export interface AWSCredentials {
  access_key_id: string;
  secret_access_key: string;
}

export const createAWSCredentialsApi = async (credentials: Omit<AWSCredentials, 'created_at'>) => {
  const response = await api.post('/account/aws_credentials', credentials);
  return response.data;
};

export const getAWSCredentialsApi = async () => {
  const response = await api.get('/account/aws_credentials');
  return response.data;
};

export const deleteAWSCredentialsApi = async () => {
  const response = await api.delete('/account/aws_credentials');
  return response.data;
};

// OCR APIs
export interface OCRMetadataResponse {
  n_pages: number;
  ocr_date: string;
}

export const getOCRBlocksApi = async (documentId: string) => {
  const response = await api.get(`/ocr/download/blocks/${documentId}`);
  return response.data;
};

export const getOCRTextApi = async (documentId: string, pageNum?: number) => {
  const url = `/ocr/download/text/${documentId}${pageNum ? `?page_num=${pageNum}` : ''}`;
  const response = await api.get(url);
  return response.data;
};

export const getOCRMetadataApi = async (documentId: string) => {
  const response = await api.get<OCRMetadataResponse>(`/ocr/download/metadata/${documentId}`);
  return response.data;
};

// LLM APIs

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface LLMRunResponse {
  status: string;
  result: Record<string, JsonValue>;
}

export interface LLMResult {
  prompt_id: string;
  document_id: string;
  llm_result: Record<string, JsonValue>;
}

export const runLLMAnalysisApi = async (
  documentId: string,
  promptId: string = 'default',
  force: boolean = false
) => {
  const response = await api.post<LLMRunResponse>(
    `/llm/run/${documentId}`,
    {},
    {
      params: {
        prompt_id: promptId,
        force: force
      }
    }
  );
  return response.data;
};

export const getLLMResultApi = async (
  documentId: string,
  promptId: string = 'default'
) => {
  const response = await api.get<LLMResult>(
    `/llm/result/${documentId}`,
    {
      params: {
        prompt_id: promptId
      }
    }
  );
  return response.data;
};

export const deleteLLMResultApi = async (
  documentId: string,
  promptId: string
) => {
  const response = await api.delete(
    `/llm/result/${documentId}`,
    {
      params: {
        prompt_id: promptId
      }
    }
  );
  return response.data;
};

// Schema APIs

export interface SchemaField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'datetime';
}

export interface SchemaCreate {
  name: string;
  fields: SchemaField[];
}

export interface Schema extends SchemaCreate {
  id: string;
  version: number;
  created_at: string;
  created_by: string;
}

export interface ListSchemasParams {
  skip?: number;
  limit?: number;
}

export interface ListSchemasResponse {
  schemas: Schema[];
  total_count: number;
  skip: number;
}

export const createSchemaApi = async (schema: SchemaCreate) => {
  const response = await api.post<Schema>('/schemas', schema);
  return response.data;
};

export const getSchemasApi = async (params?: ListSchemasParams): Promise<ListSchemasResponse> => {
  const response = await api.get<ListSchemasResponse>('/schemas', {
    params: {
      skip: params?.skip || 0,
      limit: params?.limit || 10
    }
  });
  return response.data;
};

export const getSchemaApi = async (schemaId: string) => {
  const response = await api.get<Schema>(`/schemas/${schemaId}`);
  return response.data;
};

export const deleteSchemaApi = async (schemaId: string) => {
  const response = await api.delete(`/schemas/${schemaId}`);
  return response.data;
};

export const updateSchemaApi = async (id: string, schema: {name: string; fields: SchemaField[]}) => {
  const response = await api.put<Schema>(`/schemas/${id}`, schema);
  return response.data;
};

// Prompt APIs

export interface PromptField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'datetime';
}

export interface PromptCreate {
  name: string;
  content: string;
  schema_name?: string;
  schema_version?: number;
  tag_ids?: string[];
}

export interface Prompt {
  id: string;
  name: string;
  content: string;
  schema_name: string;
  schema_version: number;
  version: number;
  created_at: string;
  created_by: string;
  tag_ids: string[];
}

export interface ListPromptsResponse {
  prompts: Prompt[];
  total_count: number;
  skip: number;
}

export const createPromptApi = async (prompt: PromptCreate): Promise<Prompt> => {
  const response = await api.post<Prompt>('/prompts', prompt);
  return response.data;
};

export interface ListPromptsParams {
  skip?: number;
  limit?: number;
  document_id?: string;
  tag_ids?: string;
}

export const getPromptsApi = async (params?: ListPromptsParams): Promise<ListPromptsResponse> => {
  const response = await api.get<ListPromptsResponse>('/prompts', {
    params: {
      skip: params?.skip || 0,
      limit: params?.limit || 10,
      document_id: params?.document_id,
      tag_ids: params?.tag_ids
    }
  });
  return response.data;
};

export const getPromptApi = async (promptId: string): Promise<Prompt> => {
  const response = await api.get<Prompt>(`/prompts/${promptId}`);
  return response.data;
};

export const updatePromptApi = async (id: string, prompt: PromptCreate): Promise<Prompt> => {
  const response = await api.put<Prompt>(`/prompts/${id}`, prompt);
  return response.data;
};

export const deletePromptApi = async (promptId: string): Promise<void> => {
  const response = await api.delete(`/prompts/${promptId}`);
  return response.data;
};

// Tag APIs

export interface TagCreate {
    name: string;
    color?: string;
    description?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface ListTagsResponse {
    tags: Tag[];
}

export const createTagApi = async (tag: TagCreate): Promise<Tag> => {
    const response = await api.post<Tag>('/tags', tag);
    return response.data;
};

export const getTagsApi = async (): Promise<ListTagsResponse> => {
    const response = await api.get<ListTagsResponse>('/tags');
    return response.data;
};

export const deleteTagApi = async (tagId: string): Promise<void> => {
    await api.delete(`/tags/${tagId}`);
};

export const updateTagApi = async (tagId: string, tag: TagCreate): Promise<Tag> => {
    const response = await api.put<Tag>(`/tags/${tagId}`, tag);
    return response.data;
};

// Organization APIs
export const getOrganizationsApi = async (userId?: string): Promise<ListOrganizationsResponse> => {
  const response = await api.get('/account/organizations', {
    params: userId ? { user_id: userId } : undefined
  });
  return response.data;
};

export const createOrganizationApi = async (organization: CreateOrganizationRequest): Promise<Organization> => {
  const response = await api.post('/account/organizations', organization);
  const data = response.data;
  return {
    id: data._id || data.id,
    name: data.name,
    members: data.members,
    type: data.type,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
};

export const updateOrganizationApi = async (
  organizationId: string, 
  update: UpdateOrganizationRequest
): Promise<Organization> => {
  const response = await api.put(`/account/organizations/${organizationId}`, update);
  return response.data;
};

export const deleteOrganizationApi = async (organizationId: string) => {
  const response = await api.delete(`/account/organizations/${organizationId}`);
  return response.data;
};

// User APIs

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: boolean | null;
  createdAt: string;
  hasPassword: boolean;
}

export interface ListUsersResponse {
  users: UserResponse[];
  total_count: number;
  skip: number;
}

export interface UserCreate {
  email: string;
  name: string;
  password: string;
  role?: string;
}

export interface UserUpdate {
  name?: string;
  role?: string;
  emailVerified?: boolean;
  password?: string;
}

export const getUsersApi = async (params?: ListUsersParams): Promise<ListUsersResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.skip) queryParams.append('skip', params.skip.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.organization_id) queryParams.append('organization_id', params.organization_id);

  const response = await api.get<ListUsersResponse>(
    `/account/users?${queryParams.toString()}`
  );
  return response.data;
};

export const createUserApi = async (user: UserCreate): Promise<UserResponse> => {
  const response = await api.post('/account/users', user);
  return response.data;
};

export const deleteUserApi = async (userId: string): Promise<void> => {
  await api.delete(`/account/users/${userId}`);
};

export const getUserApi = async (userId: string): Promise<UserResponse> => {
  const response = await api.get<UserResponse>(`/account/users/${userId}`);
  return response.data;
};

export const updateUserApi = async (userId: string, update: UserUpdate): Promise<UserResponse> => {
  const response = await api.put<UserResponse>(`/account/users/${userId}`, update);
  return response.data;
};

export function getApiErrorMsg(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (isAxiosError(error)) {
    const responseData = error.response?.data as { detail?: string };
    if (responseData?.detail) {
      return responseData.detail;
    }
    if (error.message) {
      return error.message;
    }
  }

  // Fallback for unknown error types
  return 'An unexpected error occurred. Please try again.';
}

export const sendVerificationEmailApi = async (userId: string) => {
  const response = await api.post(`/auth/send-verification-email/${userId}`);
  return response.data;
};

export const verifyEmailApi = async (token: string) => {
  const response = await api.post(`/auth/verify-email/${token}`);
  return response.data;
};
