'use client'

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import ProfileManager from '@/components/ProfileManager';

const ProfilePage: React.FC = () => {
  return (
    <SettingsLayout selectedMenu="user_profile">
      <div>
        <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>
        <ProfileManager />
      </div>
    </SettingsLayout>
  );
};

export default ProfilePage;
