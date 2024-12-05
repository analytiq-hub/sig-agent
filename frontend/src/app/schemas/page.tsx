'use client'

import React from 'react';
import Schemas from '@/components/Schemas';

const SchemasPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Schemas</h1>
      <Schemas />
    </div>
  );
};

export default SchemasPage;
