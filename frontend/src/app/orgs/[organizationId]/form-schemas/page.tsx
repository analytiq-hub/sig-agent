'use client'

import FormSchemaList from '@/components/FormSchemaList';
import FormSchemaCreate from '@/components/FormSchemaCreate';
import { useSearchParams, useRouter } from 'next/navigation';

export default function FormSchemasPage({ params }: { params: { organizationId: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab') || 'schemas';

  const handleTabChange = (newValue: string) => {
    router.push(`/orgs/${params.organizationId}/form-schemas?tab=${newValue}`);
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
            >
              Schemas
            </button>
            <button
              onClick={() => handleTabChange('schema-create')}
              className={`pb-4 px-1 relative font-semibold text-base ${
                tab === 'schema-create'
                  ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              data-tour="schema-create"
            >
              Create Schema
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div role="tabpanel" hidden={tab !== 'schemas'}>
            {tab === 'schemas' && <FormSchemaList organizationId={params.organizationId} />}
          </div>
          <div role="tabpanel" hidden={tab !== 'schema-create'}>
            {tab === 'schema-create' && <FormSchemaCreate organizationId={params.organizationId} />}
          </div>
        </div>
      </div>
  );
}
