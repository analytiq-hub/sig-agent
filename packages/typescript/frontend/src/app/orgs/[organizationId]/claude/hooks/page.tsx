'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import ClaudeHooksList from '@/components/ClaudeHooksList';

export default function ClaudeHooksPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Claude Hooks</h1>
        <p className="text-gray-600 mt-2">
          View and analyze Claude hook interactions for your organization.
        </p>
      </div>
      
      <ClaudeHooksList organizationId={organizationId} />
    </div>
  );
}
