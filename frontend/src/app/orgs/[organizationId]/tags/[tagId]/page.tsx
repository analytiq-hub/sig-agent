'use client';

import { useParams } from 'next/navigation';
import TagCreate from '@/components/TagCreate';

export default function TagEditPage() {
  const { organizationId, tagId } = useParams();

  return (
    <TagCreate organizationId={organizationId as string} tagId={tagId as string} />
  );
}

