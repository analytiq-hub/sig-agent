'use client'

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import LLMTokenManager from '@/components/LLMTokenManager';

const LLMTokensPage: React.FC = () => {
  return (
    <SettingsLayout selectedMenu="system_development">
      <div>
        <h2 className="text-xl font-semibold mb-4">LLM Token Management</h2>
        <LLMTokenManager />
      </div>
    </SettingsLayout>
  );
};

export default LLMTokensPage;
