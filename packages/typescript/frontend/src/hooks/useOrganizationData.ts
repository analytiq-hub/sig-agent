import { useState, useEffect, useCallback, useMemo } from 'react';
import { Organization } from '@sigagent/sdk';
import { SigAgentAccountApi } from '@/utils/api';
import { useOrganization } from '@/contexts/OrganizationContext';

export const useOrganizationData = (organizationId: string) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { refreshOrganizations } = useOrganization();
  const sigAgentAccountApi = useMemo(() => new SigAgentAccountApi(), []);

  const fetchOrganization = useCallback(async () => {
    try {
      setLoading(true);
      const org = await sigAgentAccountApi.getOrganization(organizationId);
      setOrganization(org);
    } catch (error) {
      console.error('Error fetching organization:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, sigAgentAccountApi]);

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