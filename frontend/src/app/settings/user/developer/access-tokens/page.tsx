'use client'

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import AccessTokenManager from '@/components/AccessTokenManager';

const AccessTokensPage: React.FC = () => {
  return (
    <SettingsLayout selectedMenu="user_developer">
      <div>
        <h2 className="text-xl font-semibold mb-4">Access Token Management</h2>
        <AccessTokenManager />
      </div>
    </SettingsLayout>
  );
};

export default AccessTokensPage; 