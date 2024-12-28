'use client'

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import UserProfileManager from '@/components/UserProfileManager';

const ProfilePage: React.FC = () => {
  return (
    <SettingsLayout selectedMenu="user_profile">
      <div>
        <UserProfileManager />
      </div>
    </SettingsLayout>
  );
};

export default ProfilePage;
