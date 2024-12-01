'use client'

import LLMTokenManager from '@/components/LLMTokenManager';


const LLMTokensPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Large Language Model (LLM) Tokens</h1>
      <LLMTokenManager />
    </div>
  );
};

export default LLMTokensPage;
