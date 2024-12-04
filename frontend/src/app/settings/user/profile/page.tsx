'use client'

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import ProfileManager from '@/components/ProfileManager';

const ProfilePage: React.FC = () => {
  return (
    <SettingsLayout selectedMenu="user_profile">
      <div>
        <ProfileManager />
      </div>
    </SettingsLayout>
  );
};

export default ProfilePage;
