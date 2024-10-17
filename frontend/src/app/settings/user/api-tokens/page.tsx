'use client'

import ApiTokenManager from '@/components/ApiTokenManager';


const ApiTokensPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage API Tokens</h1>
      <ApiTokenManager />
    </div>
  );
};

export default ApiTokensPage;
