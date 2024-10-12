'use client'

import React from 'react';
import FileUpload from '@/components/FileUpload';

const UploadFilesPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">File Upload</h1>
      <FileUpload />
    </div>
  );
};

export default UploadFilesPage
