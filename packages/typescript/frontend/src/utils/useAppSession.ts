'use client'
// This file is deprecated. Use `useAppSession` from '@/contexts/AppSessionContext' instead
import { useAppSession as useAppSessionContext } from '@/contexts/AppSessionContext';

export function useAppSession() {
  return useAppSessionContext();
} 