'use client'

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import LLMManager from '@/components/LLMManager';

const LLMTokensPage: React.FC = () => {
  return (
    <SettingsLayout selectedMenu="system_development">
      <div>
        <h2 className="text-xl font-semibold mb-4">LLM Management</h2>
        <LLMManager />
      </div>
    </SettingsLayout>
  );
};

export default LLMTokensPage;
