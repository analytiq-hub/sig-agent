'use client'

import React from 'react';
import ApiTokenManager from '@/components/ApiTokenManager';

const UserSettingsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">User Settings</h1>
      <p className="text-gray-600 mb-4">Manage your configuration</p>
      <hr className="mb-4 border-t-2" />
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold">Access tokens</h2>
          <p className="text-gray-600 mb-2">
            Set up secure API authentication using access tokens
          </p>
        </div>
        <button className="bg-white border border-gray-300 rounded px-4 py-2">
          Manage
        </button>
      </div>
      <ApiTokenManager />
    </div>
  );
};

export default UserSettingsPage;
