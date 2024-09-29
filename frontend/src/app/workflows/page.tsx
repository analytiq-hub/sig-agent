'use client'

import React from 'react';
import Test from '@/components/Workflows';

const WorkflowsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Workflows Page</h1>
      <Test />
    </div>
  );
};

export default WorkflowsPage;
