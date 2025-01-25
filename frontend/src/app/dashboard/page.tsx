'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getOrganizationsApi } from '@/utils/api';
import { toast } from 'react-hot-toast';

export default function DashboardRedirect() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    const redirectToDashboard = async () => {
      if (status === 'authenticated') {
        try {
          const { organizations } = await getOrganizationsApi();
          
          if (organizations && organizations.length > 0) {
            router.push(`/orgs/${organizations[0].id}/dashboard`);
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
        router.push('/auth/signin');
      }
    };

    redirectToDashboard();
  }, [router, status]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
} 