import axios from 'axios';
import { FileWithContent } from '@/app/types/Api';
import { getSession } from 'next-auth/react';
import { AppSession } from '@/app/types/AppSession';

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

// Add response interceptor for debugging
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  console.error('API Error:', {
    status: error.response?.status,
    data: error.response?.data,
    config: error.config
  });
  return Promise.reject(error);
});

export const uploadFilesApi = async (files: FileWithContent[]) => {
  const response = await api.post('/files/upload', { files });
  return response.data;
};

export const listFilesApi = async () => {
  console.log('NEXT_PUBLIC_FASTAPI_FRONTEND_URL:', NEXT_PUBLIC_FASTAPI_FRONTEND_URL);
  console.log('NEXT_PUBLIC_FASTAPI_FRONTEND_URL env:', process.env.NEXT_PUBLIC_FASTAPI_FRONTEND_URL);
  const response = await api.get('/files/list');
  return response.data;
};

export const downloadFileApi = async (id: string) => {
  const response = await api.get(`/files/download/${id}`, {
    responseType: 'arraybuffer' // Spent an evening figuring out why this was necessary
  }) 
  console.log('downloadFileApi(): response:', response);
  return { data: response.data, headers: response.headers };
};

export const deleteFileApi = async (id: string) => {
  const response = await api.delete(`/files/delete/${id}`);
  return response.data;
};

export interface CreateTokenRequest {
  name: string;
  lifetime: number;
}

export const createTokenApi = async (token: CreateTokenRequest) => {
  const response = await api.post('/api_tokens', token);
  return response.data;
};

// A more consistent name for this function would be getApiTokensApi, but that is too repetitive
export const getTokensApi = async () => {
  const response = await api.get('/api_tokens');
  return response.data;
};

export const deleteTokenApi = async (tokenId: string) => {
  const response = await api.delete(`/api_tokens/${tokenId}`);
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
  const response = await api.post('/llm_tokens', tokenRequest);
  return response.data;
};

export const getLLMTokensApi = async () => {
  const response = await api.get('/llm_tokens');
  return response.data;
};

export const deleteLLMTokenApi = async (tokenId: string) => {
  const response = await api.delete(`/llm_tokens/${tokenId}`);
  return response.data;
};

export default api;
