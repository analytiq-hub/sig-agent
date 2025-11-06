'use client'

import { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppSession } from '@/contexts/AppSessionContext';
import { SigAgentAccountApi } from '@/utils/api';
import { AppSession } from '@/types/AppSession';
import { toast } from 'react-toastify';

export default function DashboardRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { session, status } = useAppSession();
  const sigAgentAccountApi = useMemo(() => new SigAgentAccountApi(), []);

  useEffect(() => {
    const redirectToDashboard = async () => {
      if (status === 'authenticated') {
        try {
          const appSession = session as AppSession | null;
          if (!appSession?.user?.id) {
            console.warn('No user ID found in session');
            return;
          }

          const response = await sigAgentAccountApi.listOrganizations({ userId: appSession.user.id });
          const { organizations } = response;
          
          if (organizations && organizations.length > 0) {
            router.push(`/orgs/${organizations[0].id}/docs`);
          } else {
            toast.error('No organizations found');
            router.push('/settings/organizations');
          }
        } catch (error) {
          console.error('Error fetching organizations:', error);
          toast.error('Failed to fetch organizations');
          router.push('/settings/organizations');
        }
      } else if (status === 'unauthenticated') {
        // Preserve the current URL as callbackUrl so user returns here after login
        const callbackUrl = encodeURIComponent(pathname);
        router.push(`/auth/signin?callbackUrl=${callbackUrl}`);
      }
    };

    redirectToDashboard();
  }, [router, status, session, sigAgentAccountApi, pathname]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
} 