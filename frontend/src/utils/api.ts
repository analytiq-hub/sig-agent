import axios from 'axios';
import { FileWithContent } from '@/app/types/Api';
import { getSession } from 'next-auth/react';
import { AppSession } from '@/app/types/AppSession';

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL
if (!NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is not set');
}

const api = axios.create({
  baseURL: NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // This is the important line
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
  const response = await api.post('/api/upload', { files });
  return response.data;
};

export const listFilesApi = async () => {
  const response = await api.get('/api/list');
  return response.data;
};

export const downloadFileApi = async (id: string) => {
  const response = await api.get(`/api/download/${id}`, {
    responseType: 'arraybuffer' // Spent an evening figuring out why this was necessary
  }) 
  return response.data;
};

export interface CreateTokenRequest {
  name: string;
  lifetime: number;
}

export const createTokenApi = async (token: CreateTokenRequest) => {
  const response = await api.post('/api/tokens', token);
  return response.data;
};

export const getTokensApi = async () => {
  const response = await api.get('/api/tokens');
  return response.data;
};

export const deleteTokenApi = async (tokenId: string) => {
  const response = await api.delete(`/api/tokens/${tokenId}`);
  return response.data;
};

export default api;
