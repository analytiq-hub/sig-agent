import { useState, useEffect, useCallback } from 'react';
import { Organization } from '@/types/index';
import { getOrganizationApi } from '@/utils/api';
import { useOrganization } from '@/contexts/OrganizationContext';

export const useOrganizationData = (organizationId: string) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { refreshOrganizations } = useOrganization();

  const fetchOrganization = useCallback(async () => {
    try {
      setLoading(true);
      const org = await getOrganizationApi(organizationId);
      setOrganization(org);
    } catch (error) {
      console.error('Error fetching organization:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

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