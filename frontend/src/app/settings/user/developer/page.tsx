'use client'

import React from 'react';
import AccessTokenManager from '@/components/AccessTokenManager';

const DeveloperPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Developer Settings</h1>
      <AccessTokenManager />
    </div>
  );
};

export default DeveloperPage;
