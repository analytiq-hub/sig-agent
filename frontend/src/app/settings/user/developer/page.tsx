'use client'

import React from 'react';
import AccessTokenManager from '@/components/AccessTokenManager';
import SettingsLayout from '@/components/SettingsLayout';

const DeveloperPage: React.FC = () => {
  return (
    <SettingsLayout selectedMenu="user_developer">
      <AccessTokenManager />
    </SettingsLayout>
  );
};

export default DeveloperPage;
