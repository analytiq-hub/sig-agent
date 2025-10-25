'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import ClaudeLogsList from '@/components/ClaudeLogsList';

export default function ClaudeTracesPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Claude Logs</h1>
        <p className="text-gray-600 mt-2">
          View and analyze Claude interaction logs for your organization.
        </p>
      </div>
      
      <ClaudeLogsList organizationId={organizationId} />
    </div>
  );
}
