'use client'

import React from 'react';
import ApiTokenManager from '@/components/ApiTokenManager';

const UserSettingsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">User Settings</h1>
      <ApiTokenManager />
    </div>
  );
};

export default UserSettingsPage;
