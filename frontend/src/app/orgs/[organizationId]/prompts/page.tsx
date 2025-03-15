'use client'

import Prompts from '@/components/Prompts';

const PromptsPage: React.FC<{ params: { organizationId: string } }> = ({ params }) => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">
        Prompts
      </h1>
      <Prompts organizationId={params.organizationId}/>
    </div>
  );
};

export default PromptsPage;
