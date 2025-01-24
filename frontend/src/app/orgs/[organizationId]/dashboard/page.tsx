'use client'

import React, { useEffect, useState } from 'react';
import Dashboard from '@/components/Dashboard';
import { getOrganizationApi } from '@/utils/api';
import { Organization } from '@/types';
import { toast } from 'react-hot-toast';

const DashboardPage: React.FC<{ params: { organizationId: string } }> = ({ params }) => {
  const [organization, setOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const org = await getOrganizationApi(params.organizationId);
        setOrganization(org);
      } catch (error) {
        toast.error(`Failed to load organization details: ${error}`);
      }
    };

    fetchOrganization();
  }, [params.organizationId]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">
        {organization ? `Organization: ${organization.name}` : 'Organization Dashboard'}
      </h1>
      <Dashboard organizationId={params.organizationId} />
    </div>
  );
};

export default DashboardPage;
