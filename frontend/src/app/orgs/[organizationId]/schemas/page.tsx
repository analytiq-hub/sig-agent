'use client'

import Schemas from '@/components/Schemas';

import DocumentUpload from '@/components/DocumentUpload';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SchemasPage({ params }: { params: { organizationId: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab') || 'schemas';

  const handleTabChange = (newValue: string) => {
    router.push(`/orgs/${params.organizationId}/schemas?tab=${newValue}`);
  };

  return (
    <div className="p-4">
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-8">
          <button
            onClick={() => handleTabChange('schemas')}
            className={`pb-4 px-1 relative font-semibold text-base ${
              tab === 'schemas'
                ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            data-tour="documents-tab"
          >
            Schemas
          </button>
          <button
            onClick={() => handleTabChange('create-schema')}
            className={`pb-4 px-1 relative font-semibold text-base ${
              tab === 'create-schema'
                ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            data-tour="upload-tab"
          >
            Create Schema
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div role="tabpanel" hidden={tab !== 'schemas'}>
          {tab === 'schemas' && <Schemas organizationId={params.organizationId} />}
        </div>
        <div role="tabpanel" hidden={tab !== 'create-schema'}>
          {tab === 'create-schema' && <DocumentUpload organizationId={params.organizationId} />}
        </div>
      </div>
    </div>
  );
}
