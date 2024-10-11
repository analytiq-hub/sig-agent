import axios from 'axios';
import { FileWithContent } from '@/app/types/FileWithContent';

const API_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // This is the important line
});


export const uploadFiles = async (files: FileWithContent[], token: string) => {
  const response = await api.post('/upload', { files }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const listFiles = async (token: string) => {
  const response = await api.get('/list', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const downloadFile = async (id: string, token: string) => {
  const response = await api.get(`/lookup/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseType: 'blob',
  });
  return response.data;
};

export default api;
