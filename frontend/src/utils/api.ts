import axios from 'axios';
import { FileWithContent } from '@/app/types/Api';
import { getSession } from 'next-auth/react';
import { AppSession } from '@/app/types/AppSession';

// Function to get the API URL dynamically
const getApiUrl = () => {
  // When running in the browser
  if (typeof window !== 'undefined') {
    // If NEXT_PUBLIC_API_URL is set, use it
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    
    // Otherwise, derive it from the current window location
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8000`;
  }
  
  // Server-side fallback
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
};

const NEXT_PUBLIC_API_URL = getApiUrl();

const api = axios.create({
  baseURL: NEXT_PUBLIC_API_URL,
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
  }
  return config;
});

export const uploadFilesApi = async (files: FileWithContent[]) => {
  const response = await api.post('/api/files/upload', { files });
  return response.data;
};

export const listFilesApi = async () => {
  const response = await api.get('/api/files/list');
  return response.data;
};

export const downloadFileApi = async (id: string) => {
  const response = await api.get(`/api/files/download/${id}`, {
    responseType: 'arraybuffer' // Spent an evening figuring out why this was necessary
  }) 
  console.log('downloadFileApi(): response:', response);
  return { data: response.data, headers: response.headers };
};

export const deleteFileApi = async (id: string) => {
  const response = await api.delete(`/api/files/delete/${id}`);
  return response.data;
};

export interface CreateTokenRequest {
  name: string;
  lifetime: number;
}

export const createTokenApi = async (token: CreateTokenRequest) => {
  const response = await api.post('/api/api_tokens', token);
  return response.data;
};

// A more consistent name for this function would be getApiTokensApi, but that is too repetitive
export const getTokensApi = async () => {
  const response = await api.get('/api/api_tokens');
  return response.data;
};

export const deleteTokenApi = async (tokenId: string) => {
  const response = await api.delete(`/api/api_tokens/${tokenId}`);
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
  const response = await api.post('/api/llm_tokens', tokenRequest);
  return response.data;
};

export const getLLMTokensApi = async () => {
  const response = await api.get('/api/llm_tokens');
  return response.data;
};

export const deleteLLMTokenApi = async (tokenId: string) => {
  const response = await api.delete(`/api/llm_tokens/${tokenId}`);
  return response.data;
};

export default api;
