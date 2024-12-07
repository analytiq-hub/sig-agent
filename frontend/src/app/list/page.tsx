'use client'

import React from 'react';
import DocumentList from '@/components/DocumentList';

const ListDocumentsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Documents</h1>
      <DocumentList />
    </div>
  );
};

export default ListDocumentsPage;
