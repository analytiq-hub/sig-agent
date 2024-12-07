'use client'

import React from 'react';
import DocumentUpload from '@/components/DocumentUpload';

const UploadDocumentsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Document Upload</h1>
      <DocumentUpload />
    </div>
  );
};

export default UploadDocumentsPage
