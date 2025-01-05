'use client'
import { useSession } from 'next-auth/react';
import { AppSession } from '@/types/AppSession';

export function useAppSession() {
  const { data: session, status } = useSession();
  return {
    session: session as AppSession | null,
    status
  };
} 