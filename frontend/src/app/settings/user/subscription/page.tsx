'use client'

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import { useAppSession } from '@/utils/useAppSession';
import Subscription from '@/components/Subscription';

const SubscriptionPage: React.FC = () => {
  const { session, status } = useAppSession();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <SettingsLayout selectedMenu="user_subscription">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your subscription and billing information
          </p>
        </div>

        {session?.user?.id && <Subscription userId={session.user.id} />}
      </div>
    </SettingsLayout>
  );
};

export default SubscriptionPage;