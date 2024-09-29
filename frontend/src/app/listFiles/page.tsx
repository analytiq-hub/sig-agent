'use client'

import React from 'react';
import Test from '@/components/ListFiles';

const ListFilesPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">List Files Page</h1>
      <Test />
    </div>
  );
};

export default ListFilesPage;
