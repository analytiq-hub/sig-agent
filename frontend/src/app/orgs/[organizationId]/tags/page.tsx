'use client'

import Tags from '@/components/Tags';

const TagsPage: React.FC<{ params: { organizationId: string } }> = ({ params }) => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">
        Tags
      </h1>
      <Tags organizationId={params.organizationId}/>
    </div>
  );
};

export default TagsPage;
