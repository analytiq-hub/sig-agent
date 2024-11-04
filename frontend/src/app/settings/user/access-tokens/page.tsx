'use client'

import ApiTokenManager from '@/components/ApiTokenManager';

const ApiTokensPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Access Tokens</h1>
      <p className="text-gray-600 mb-4">Use Access Tokens to authenticate with our API.</p>
      <ApiTokenManager />
    </div>
  );
};

export default ApiTokensPage;
