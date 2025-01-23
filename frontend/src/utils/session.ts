import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { AppSession } from '@/types/AppSession';

export async function getAppServerSession() {
  const session = await getServerSession(authOptions);
  return session as AppSession;
} 