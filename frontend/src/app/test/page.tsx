'use client'

import React from 'react';
import Dashboard from '@/components/Dashboard';

const TestPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">File Dashboard</h1>
      <Dashboard />
    </div>
  );
};

export default TestPage;
