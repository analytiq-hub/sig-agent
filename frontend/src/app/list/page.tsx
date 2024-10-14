'use client'

import React from 'react';
import FileList from '@/components/FileList';

const ListFilesPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">File List</h1>
      <FileList />
    </div>
  );
};

export default ListFilesPage;
