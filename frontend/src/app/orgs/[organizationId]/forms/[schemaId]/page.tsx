'use client';

import { useParams, useRouter } from 'next/navigation';
import FormSchemaCreate from '@/components/FormSchemaCreate';

export default function FormSchemaEditPage() {
  const { organizationId, schemaId } = useParams();
  const router = useRouter();

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Back to Forms Button */}
      <button
        onClick={() => router.push(`/orgs/${organizationId}/forms`)}
        className="mb-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
      >
        ← Back to Schemas
      </button>

      <FormSchemaCreate organizationId={organizationId as string} schemaId={schemaId as string} />
    </div>
  );
} 