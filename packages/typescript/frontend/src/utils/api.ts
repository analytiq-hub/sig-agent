import axios, { isAxiosError } from 'axios';
import { getSession } from 'next-auth/react';
import { AppSession } from '@/types/AppSession';
import { DocRouterOrg, DocRouterAccount } from '@docrouter/sdk';

// Session cache to avoid repeated calls
let sessionCache: { session: AppSession | null; timestamp: number } | null = null;
const SESSION_CACHE_DURATION = 30000; // 30 seconds

// Global session reference for context-based access
let globalSession: AppSession | null = null;

export function setGlobalSession(session: AppSession | null): void {
  globalSession = session;
}

export function getGlobalSession(): AppSession | null {
  return globalSession;
}

export async function getCachedSession(): Promise<AppSession | null> {
  // First try to use global session from context
  if (globalSession) {
    return globalSession;
  }
  
  const now = Date.now();
  
  if (sessionCache && (now - sessionCache.timestamp) < SESSION_CACHE_DURATION) {
    return sessionCache.session;
  }
  
  const session = await getSession() as AppSession | null;
  sessionCache = { session, timestamp: now };
  return session;
}

// Function to invalidate session cache
export function invalidateSessionCache(): void {
  sessionCache = null;
  globalSession = null;
}

import { 
  UserCreate, 
  UserUpdate, 
  UserResponse, 
  ListUsersParams, 
  ListUsersResponse 
} from '@/types/index';
import { 
  CreateOrganizationRequest, 
  ListOrganizationsResponse, 
  Organization, 
  UpdateOrganizationRequest 
} from '@/types/index';
import { 
  InvitationResponse, 
  CreateInvitationRequest, 
  ListInvitationsParams, 
  ListInvitationsResponse, 
  AcceptInvitationRequest 
} from '@/types/index';
import { CreateTokenRequest } from '@/types/index';
import { AWSConfig } from '@/types/index';
import {
  ListLLMModelsParams,
  ListLLMModelsResponse,
  ListLLMProvidersResponse,
  SetLLMProviderConfigRequest,
  RunLLMParams,
  RunLLMResponse, 
  GetLLMResultParams,
  GetLLMResultResponse,
  DeleteLLMResultParams,
} from '@/types/index';
import { 
  PortalSessionResponse,
  SubscriptionResponse,
  UsageResponse,
  CreditConfig,
  CreditUpdateResponse,
  UsageRangeRequest,
  UsageRangeResponse,
} from '@/types/index';
import { toast } from 'react-toastify';
import { JsonValue } from 'type-fest';
import { LLMChatRequest, LLMChatResponse, LLMChatStreamChunk, LLMChatStreamError } from '@/types/llm';

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
  // First try to use global session (pre-fetched from context)
  let session = getGlobalSession();
  
  // Fallback to cached session if global session is not available
  if (!session) {
    session = await getCachedSession();
  }
  
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

// Store the toast ID outside the interceptor
let sessionExpiredToastId: React.ReactText | null = null;

// Add a response interceptor that handles all errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 402 errors (payment required)
    if (error.response?.status === 402) {
      toast.error('Insufficient credits. Please upgrade your plan to continue using AI features.', {
        toastId: 'payment-required', // Prevent duplicate toasts
        autoClose: 8000
      });
      return Promise.reject(error);
    }

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch(() => {
            // Only show session expiration toast once
            if (!sessionExpiredToastId || !toast.isActive(sessionExpiredToastId)) {
              sessionExpiredToastId = toast.error('Your session has expired. Please login again.');
            }
            return Promise.reject(new Error('Session expired'));
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Invalidate cache and get fresh session on 401
        invalidateSessionCache();
        const session = await getCachedSession();
        if (session?.apiAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${session.apiAccessToken}`;
          processQueue();
          return api(originalRequest);
        } else {
          if (!sessionExpiredToastId || !toast.isActive(sessionExpiredToastId)) {
            sessionExpiredToastId = toast.error('Your session has expired. Please login again.');
          }
          return Promise.reject(new Error('Session expired'));
        }
      } catch (refreshError) {
        processQueue(refreshError instanceof Error ? refreshError : new Error('Token refresh failed'));
        if (!sessionExpiredToastId || !toast.isActive(sessionExpiredToastId)) {
          sessionExpiredToastId = toast.error('Your session has expired. Please login again.');
        }
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

export class DocRouterOrgApi extends DocRouterOrg {
 constructor(organizationId: string) {
    super({
      baseURL: NEXT_PUBLIC_FASTAPI_FRONTEND_URL,
      orgToken: '', // Empty token so tokenProvider will be used
      organizationId: organizationId,
    });
    
    // Set up token provider that gets called on every request
    this.getHttpClient().updateTokenProvider(async () => {
      // First try to use global session (pre-fetched from context)
      let session = getGlobalSession();
      
      // Fallback to cached session if global session is not available
      if (!session) {
        session = await getCachedSession();
      }
      
      return session?.apiAccessToken || '';
    });
  }
}

export class DocRouterAccountApi extends DocRouterAccount {
  constructor() {
    super({
      baseURL: NEXT_PUBLIC_FASTAPI_FRONTEND_URL,
      accountToken: '', // Empty token so tokenProvider will be used
    });
    
    // Set up token provider that gets called on every request
    this.getHttpClient().updateTokenProvider(async () => {
      // First try to use global session (pre-fetched from context)
      let session = getGlobalSession();
      
      // Fallback to cached session if global session is not available
      if (!session) {
        session = await getCachedSession();
      }
      
      return session?.apiAccessToken || '';
    });
  }
}


// LLM APIs
export const listLLMModelsApi = async (params: ListLLMModelsParams): Promise<ListLLMModelsResponse> => {
  const response = await api.get<ListLLMModelsResponse>('/v0/account/llm/models', {
    params: {
      provider_name: params.providerName,
      provider_enabled: params.providerEnabled,
      llm_enabled: params.llmEnabled,
    }
  });
  return response.data;
};

export const listLLMProvidersApi = async (): Promise<ListLLMProvidersResponse> => {
  const response = await api.get<ListLLMProvidersResponse>('/v0/account/llm/providers');
  return response.data;
};

export const setLLMProviderConfigApi = async (providerName: string, request: SetLLMProviderConfigRequest) => {
  const response = await api.put<SetLLMProviderConfigRequest>(`/v0/account/llm/provider/${providerName}`, request);
  return response.data;
};

export const runLLMApi = async (params: RunLLMParams) => {
  const { organizationId, documentId, promptRevId, force } = params;
  const response = await api.post<RunLLMResponse>(
    `/v0/orgs/${organizationId}/llm/run/${documentId}`,
    {},
    {
      params: {
        prompt_revid: promptRevId,
        force: force
      }
    }
  );
  return response.data;
};

export const getLLMResultApi = async (params: GetLLMResultParams) => {
  const { organizationId, documentId, promptRevId, fallback } = params;
  const response = await api.get<GetLLMResultResponse>(
    `/v0/orgs/${organizationId}/llm/result/${documentId}`,
    {
      params: {
        prompt_revid: promptRevId,
        fallback: fallback
      }
    }
  );
  return response.data;
};

export const updateLLMResultApi = async ({
  organizationId,
  documentId,
  promptId,
  result,
  isVerified = false
}: {
  organizationId: string;
  documentId: string;
  promptId: string;
  result: Record<string, JsonValue>;
  isVerified?: boolean;
}) => {
  const response = await api.put(
    `/v0/orgs/${organizationId}/llm/result/${documentId}`,
    {
      updated_llm_result: result,
      is_verified: isVerified
    },
    {
      params: {
        prompt_revid: promptId
      }
    }
  );

  if (response.status !== 200) {
    throw new Error(`Failed to update LLM result for document ${documentId} and prompt ${promptId}: ${response.data}`);
  }

  return response.data;
};

export const deleteLLMResultApi = async (params: DeleteLLMResultParams) => {
  const { organizationId, documentId, promptId } = params;
  const response = await api.delete(
    `/v0/orgs/${organizationId}/llm/result/${documentId}`,
    {
      params: {
        prompt_revid: promptId
      }
    }
  );
  return response.data;
};

export const downloadAllLLMResultsApi = async (params: {
  organizationId: string;
  documentId: string;
}) => {
  const { organizationId, documentId } = params;
  const response = await api.get(
    `/v0/orgs/${organizationId}/llm/results/${documentId}/download`,
    {
      responseType: 'blob'
    }
  );
  return response.data;
};

// LLM Chat API (admin only) - Account level
export const runLLMChatApi = async (request: LLMChatRequest): Promise<LLMChatResponse> => {
  const response = await api.post<LLMChatResponse>('/v0/account/llm/run', request);
  return response.data;
};

// LLM Chat API (admin only) - Organization level
export const runLLMChatOrgApi = async (organizationId: string, request: LLMChatRequest): Promise<LLMChatResponse> => {
  const response = await api.post<LLMChatResponse>(`/v0/orgs/${organizationId}/llm/run`, request);
  return response.data;
};

// LLM Chat Streaming API (admin only) - Account level
export const runLLMChatStreamApi = async (
  request: LLMChatRequest,
  onChunk: (chunk: LLMChatStreamChunk | LLMChatStreamError) => void,
  onError?: (error: Error) => void,
  abortSignal?: AbortSignal
): Promise<void> => {
  return await _runLLMChatStreamImpl('/v0/account/llm/run', request, onChunk, onError, abortSignal);
};

// LLM Chat Streaming API (admin only) - Organization level
export const runLLMChatStreamOrgApi = async (
  organizationId: string,
  request: LLMChatRequest,
  onChunk: (chunk: LLMChatStreamChunk | LLMChatStreamError) => void,
  onError?: (error: Error) => void,
  abortSignal?: AbortSignal
): Promise<void> => {
  return await _runLLMChatStreamImpl(`/v0/orgs/${organizationId}/llm/run`, request, onChunk, onError, abortSignal);
};

// Internal implementation for LLM Chat Streaming
const _runLLMChatStreamImpl = async (
  endpoint: string,
  request: LLMChatRequest,
  onChunk: (chunk: LLMChatStreamChunk | LLMChatStreamError) => void,
  onError?: (error: Error) => void,
  abortSignal?: AbortSignal
): Promise<void> => {
  try {
    // Ensure stream is set to true for streaming requests
    const streamingRequest = { ...request, stream: true };
    
    // Get the session token for authorization
    const session = await getCachedSession();
    if (!session?.apiAccessToken) {
      throw new Error('No API token available');
    }

    // Use fetch instead of axios for streaming support
    // Note: Axios cannot handle true streaming responses because it waits for the entire
    // response to complete before resolving the promise, even with responseType: 'text'.
    // In browsers, Axios uses XMLHttpRequest which doesn't expose partial response data.
    // Only fetch() with ReadableStream provides access to chunks as they arrive in real-time.
    const response = await fetch(`${NEXT_PUBLIC_FASTAPI_FRONTEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.apiAccessToken}`,
        'Accept': 'text/plain',
        'Cache-Control': 'no-cache',
      },
      credentials: 'include',
      body: JSON.stringify(streamingRequest),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is not available for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onChunk(data);
              
              // Stop if we're done
              if (data.done) {
                return;
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (onError) {
      onError(error instanceof Error ? error : new Error('Streaming request failed'));
    } else {
      throw error;
    }
  }
};





// Account Token APIs
export const createAccountTokenApi = async (token: CreateTokenRequest) => {
  const response = await api.post('/v0/account/access_tokens', token);
  return response.data;
};

export const getAccountTokensApi = async () => {
  const response = await api.get('/v0/account/access_tokens');
  return response.data;
};

export const deleteAccountTokenApi = async (tokenId: string) => {
  const response = await api.delete(`/v0/account/access_tokens/${tokenId}`);
  return response.data;
};

// Organization Token APIs
export const createOrganizationTokenApi = async (token: CreateTokenRequest, organizationId: string) => {
  const endpoint = `/v0/orgs/${organizationId}/access_tokens`;
  const response = await api.post(endpoint, token);
  return response.data;
};

export const getOrganizationTokensApi = async (organizationId: string) => {
  const endpoint = `/v0/orgs/${organizationId}/access_tokens`;
  const response = await api.get(endpoint);
  return response.data;
};

export const deleteOrganizationTokenApi = async (tokenId: string, organizationId: string) => {
  const endpoint = `/v0/orgs/${organizationId}/access_tokens/${tokenId}`;
  const response = await api.delete(endpoint);
  return response.data;
};

// AWS APIs
export const createAWSConfigApi = async (config: Omit<AWSConfig, 'created_at'>) => {
  const response = await api.post('/v0/account/aws_config', config);
  return response.data;
};

export const getAWSConfigApi = async () => {
  const response = await api.get('/v0/account/aws_config');
  return response.data;
};

export const deleteAWSConfigApi = async () => {
  const response = await api.delete('/v0/account/aws_config');
  return response.data;
};

// Organization APIs
export const getOrganizationsApi = async (params?: { 
  userId?: string;
  organizationId?: string;
  nameSearch?: string;
  memberSearch?: string;
  skip?: number;
  limit?: number;
}): Promise<ListOrganizationsResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.userId) queryParams.append('user_id', params.userId);
  if (params?.organizationId) queryParams.append('organization_id', params.organizationId);
  if (params?.nameSearch) queryParams.append('name_search', params.nameSearch);
  if (params?.memberSearch) queryParams.append('member_search', params.memberSearch);
  if (params?.skip !== undefined) queryParams.append('skip', String(params.skip));
  if (params?.limit !== undefined) queryParams.append('limit', String(params.limit));
  
  const response = await api.get<ListOrganizationsResponse>(
    `/v0/account/organizations?${queryParams.toString()}`
  );
  return response.data;
};

export const createOrganizationApi = async (organization: CreateOrganizationRequest): Promise<Organization> => {
  const response = await api.post('/v0/account/organizations', organization);
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

export const getOrganizationApi = async (organizationId: string): Promise<Organization> => {
  const response = await getOrganizationsApi({ organizationId });
  return response.organizations[0]; // Will always return exactly one organization
};

export const updateOrganizationApi = async (
  organizationId: string, 
  update: UpdateOrganizationRequest
): Promise<Organization> => {
  const response = await api.put(`/v0/account/organizations/${organizationId}`, update);
  return response.data;
};

export const deleteOrganizationApi = async (organizationId: string) => {
  const response = await api.delete(`/v0/account/organizations/${organizationId}`);
  return response.data;
};

// User APIs

export const getUsersApi = async (params?: ListUsersParams): Promise<ListUsersResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.skip) queryParams.append('skip', params.skip.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.organization_id) queryParams.append('organization_id', params.organization_id);
  if (params?.user_id) queryParams.append('user_id', params.user_id);
  if (params?.search_name) queryParams.append('search_name', params.search_name);

  const response = await api.get<ListUsersResponse>(
    `/v0/account/users?${queryParams.toString()}`
  );
  return response.data;
};

export const createUserApi = async (user: UserCreate): Promise<UserResponse> => {
  const response = await api.post('/v0/account/users', user);
  return response.data;
};

export const deleteUserApi = async (userId: string): Promise<void> => {
  await api.delete(`/v0/account/users/${userId}`);
};

export const getUserApi = async (userId: string): Promise<UserResponse> => {
  const response = await getUsersApi({ user_id: userId });
  return response.users[0]; // Will always return exactly one user
};

export const updateUserApi = async (userId: string, update: UserUpdate): Promise<UserResponse> => {
  const response = await api.put<UserResponse>(`/v0/account/users/${userId}`, update);
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
  const response = await api.post(`/v0/account/email/verification/send/${userId}`);
  return response.data;
};

export const verifyEmailApi = async (token: string) => {
  const response = await api.post(`/v0/account/email/verification/${token}`);
  return response.data;
};

export const sendRegistrationVerificationEmailApi = async (userId: string) => {
  const response = await api.post(`/v0/account/email/verification/register/${userId}`);
  return response.data;
};

// Invitation APIs
export const createInvitationApi = async (invitation: CreateInvitationRequest): Promise<InvitationResponse> => {
  const response = await api.post<InvitationResponse>('/v0/account/email/invitations', invitation);
  return response.data;
};

export const getInvitationsApi = async (params?: ListInvitationsParams): Promise<ListInvitationsResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.skip) queryParams.append('skip', params.skip.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const response = await api.get<ListInvitationsResponse>(
    `/v0/account/email/invitations?${queryParams.toString()}`
  );
  return response.data;
};

export const acceptInvitationApi = async (token: string, data: AcceptInvitationRequest): Promise<{ message: string }> => {
  const response = await api.post(`/v0/account/email/invitations/${token}/accept`, data);
  return response.data;
};

export const getInvitationApi = async (token: string): Promise<InvitationResponse> => {
  const response = await api.get<InvitationResponse>(`/v0/account/email/invitations/${token}`);
  return response.data;
};

// Subscription APIs
export const getCustomerPortalApi = async (orgId: string): Promise<PortalSessionResponse> => {
  const response = await api.post<PortalSessionResponse>(`/v0/orgs/${orgId}/payments/customer-portal`);
  return response.data;
};

// Add these new API functions
export const getSubscriptionApi = async (orgId: string): Promise<SubscriptionResponse> => {
  const response = await api.get<SubscriptionResponse>(`/v0/orgs/${orgId}/payments/subscription`);
  return response.data;
};

export const activateSubscriptionApi = async (orgId: string): Promise<{ status: string; message: string }> => {
  const response = await api.put<{ status: string; message: string }>(`/v0/orgs/${orgId}/payments/subscription`);
  return response.data;
};

export const cancelSubscriptionApi = async (orgId: string): Promise<{ status: string; message: string }> => {
  const response = await api.delete<{ status: string; message: string }>(`/v0/orgs/${orgId}/payments/subscription`);
  return response.data;
};

// Add new API function to get current usage
export const getCurrentUsageApi = async (orgId: string): Promise<UsageResponse> => {
  const response = await api.get<UsageResponse>(`/v0/orgs/${orgId}/payments/usage`);
  return response.data;
};


// Add new API function to add credits (admin only)
export const addCreditsApi = async (orgId: string, amount: number): Promise<CreditUpdateResponse> => {
  const response = await api.post<CreditUpdateResponse>(`/v0/orgs/${orgId}/payments/credits/add`, { amount });
  return response.data;
};

export const getCreditConfigApi = async (orgId: string): Promise<CreditConfig> => {
  const response = await api.get<CreditConfig>(`/v0/orgs/${orgId}/payments/credits/config`);
  return response.data;
};

export const purchaseCreditsApi = async (orgId: string, request: {
  credits: number;
  success_url: string;
  cancel_url: string;
}) => {
  const response = await api.post(`/v0/orgs/${orgId}/payments/credits/purchase`, request);
  return response.data;
};

// Add new API function for usage range queries
export const getUsageRangeApi = async (orgId: string, request: UsageRangeRequest): Promise<UsageRangeResponse> => {
  const response = await api.get<UsageRangeResponse>(`/v0/orgs/${orgId}/payments/usage/range`, {
    params: request
  });
  return response.data;
};

// Add this new API function after the existing subscription APIs
export const createCheckoutSessionApi = async (orgId: string, planId: string): Promise<PortalSessionResponse> => {
  const response = await api.post<PortalSessionResponse>(`/v0/orgs/${orgId}/payments/checkout-session`, { plan_id: planId });
  return response.data;
};

// Helper function to get session token for direct fetch calls (for FormIO)
export const getSessionToken = async (): Promise<string | null> => {
  const session = await getCachedSession();
  return session?.apiAccessToken || null;
};