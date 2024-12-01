'use client'

import AWSCredentialsManager from '@/components/AWSCredentialsManager';


const AWSCredentialsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage AWS Credentials</h1>
      <AWSCredentialsManager />
    </div>
  );
};

export default AWSCredentialsPage;
