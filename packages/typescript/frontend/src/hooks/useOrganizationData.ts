import { useState, useEffect, useCallback, useMemo } from 'react';
import { Organization } from '@docrouter/sdk';
import { DocRouterAccountApi } from '@/utils/api';
import { useOrganization } from '@/contexts/OrganizationContext';

export const useOrganizationData = (organizationId: string) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { refreshOrganizations } = useOrganization();
  const docRouterAccountApi = useMemo(() => new DocRouterAccountApi(), []);

  const fetchOrganization = useCallback(async () => {
    try {
      setLoading(true);
      const org = await docRouterAccountApi.getOrganization(organizationId);
      setOrganization(org);
    } catch (error) {
      console.error('Error fetching organization:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, docRouterAccountApi]);

  const refreshData = async () => {
    await refreshOrganizations();
    await fetchOrganization();
  };

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  return {
    organization,
    loading,
    refreshData,
    fetchOrganization
  };
}; 