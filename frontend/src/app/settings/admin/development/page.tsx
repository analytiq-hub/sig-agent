'use client'

import React from 'react';
import LLMTokenManager from '@/components/LLMTokenManager';
import AWSCredentialsManager from '@/components/AWSCredentialsManager';

const DevelopmentPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Development Settings</h1>
      <div className="space-y-8">
        <LLMTokenManager />
        <AWSCredentialsManager />
      </div>
    </div>
  );
};

export default DevelopmentPage;
