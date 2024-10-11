'use client'

import React from 'react';
import UploadFiles from '@/components/UploadFiles';

const UploadFilesPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Upload Page</h1>
      <UploadFiles />
    </div>
  );
};

export default UploadFilesPage
