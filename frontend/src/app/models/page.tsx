'use client'

import React from 'react';
import Flows from '@/components/Flows';

const FlowsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Flows</h1>
      <Flows />
    </div>
  );
};

export default FlowsPage;
