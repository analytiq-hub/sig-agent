'use client'

import React from 'react';
import ProfileManager from '@/components/ProfileManager';

const ProfilePage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Profile Settings</h1>
      <ProfileManager />
    </div>
  );
};

export default ProfilePage;
