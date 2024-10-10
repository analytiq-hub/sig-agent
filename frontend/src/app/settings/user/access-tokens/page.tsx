'use client'

import AccessTokenManager from '@/components/AccessTokenManager';


const AccessTokensPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Access Tokens</h1>
      <AccessTokenManager />
    </div>
  );
};

export default AccessTokensPage;
