import axios from 'axios';
import { FileWithContent } from '@/app/types/Api';
import { getSession } from 'next-auth/react';
import { AppSession } from '@/app/types/AppSession';

const API_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
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

export const uploadFiles = async (files: FileWithContent[]) => {
  const response = await api.post('/api/upload', { files });
  return response.data;
};

export const listFiles = async () => {
  const response = await api.get('/api/list');
  return response.data;
};

export const downloadFile = async (id: string) => {
  const response = await api.get(`/api/download/${id}`) 
  return response.data;
};

export default api;
