'use client'

import React from 'react';
import DocumentList from './DocumentList';

interface DashboardProps {
  organizationId: string;
}

const Dashboard: React.FC<DashboardProps> = ({ organizationId }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Documents</h2>
        <p className="text-gray-600">
          Manage and view your organization&apos;s documents.
        </p>
      </div>
      
      <DocumentList organizationId={organizationId} />
    </div>
  );
};

export default Dashboard;