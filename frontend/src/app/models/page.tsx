'use client'

import React from 'react';
import Models from '@/components/Models';

const ModelsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Models</h1>
      <Models />
    </div>
  );
};

export default ModelsPage;
