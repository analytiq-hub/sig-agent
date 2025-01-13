'use client'

import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import UserAcceptInvitation from '@/components/UserAcceptInvitation';
import { toast } from 'react-hot-toast';

const AcceptInvitationPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  if (!token) {
    toast.error('Invalid invitation link');
    router.push('/auth/signin');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Accept Invitation
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Create your account
        </p>
      </div>

      <UserAcceptInvitation token={token} />
    </div>
  );
};

export default AcceptInvitationPage; 