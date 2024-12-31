'use client'

import React, { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import SettingsLayout from '@/components/SettingsLayout';
import { AppSession } from '@/app/types/AppSession';
import UserEdit from '@/components/UserEdit';

const ProfilePage: React.FC = () => {
  const [session, setSession] = useState<AppSession | null>(null);

  useEffect(() => {
    console.log('getting session');
    getSession().then((sess) => setSession(sess as AppSession | null));
  }, []);

  console.log(`settings/user/profile session: ${JSON.stringify(session)}`);

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