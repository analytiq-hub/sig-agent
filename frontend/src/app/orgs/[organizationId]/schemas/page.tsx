'use client'

import Schemas from '@/components/Schemas';

const SchemasPage: React.FC<{ params: { organizationId: string } }> = ({ params }) => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">
        Schemas
      </h1>
      <Schemas organizationId={params.organizationId}/>
    </div>
  );
};

export default SchemasPage;
