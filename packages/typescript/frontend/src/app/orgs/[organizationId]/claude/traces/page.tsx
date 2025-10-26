'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import ClaudeTracesList from '@/components/ClaudeTracesList';

export default function ClaudeTracesPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Claude Traces</h1>
        <p className="text-gray-600 mt-2">
          View and analyze Claude trace logs for your organization.
        </p>
      </div>
      
      <ClaudeTracesList organizationId={organizationId} />
    </div>
  );
}
