'use client'

import React from 'react';
import { useSession } from 'next-auth/react';
import SettingsLayout from '@/components/SettingsLayout';
import UserEdit from '@/components/UserEdit';

const ProfilePage: React.FC = () => {
  const { data: session } = useSession();

  if (!session?.user?.id) {
    return <div>Loading...</div>;
  }
  return (
    <SettingsLayout selectedMenu="user_profile">
      <div>
      <UserEdit userId={session.user.id} />
      </div>
    </SettingsLayout>
  );
};

export default ProfilePage;
