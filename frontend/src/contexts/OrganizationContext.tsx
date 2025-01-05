'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { getOrganizationsApi } from '@/utils/api'
import { Organization } from '@/app/types/Api'
import { getSession } from 'next-auth/react'
import { AppSession } from '@/app/types/AppSession'

interface OrganizationContextType {
  organizations: Organization[]
  currentOrganization: Organization | null
  setCurrentOrganization: (organization: Organization) => void
  switchOrganization: (organizationId: string) => void
  refreshOrganizations: () => Promise<void>
  isLoading: boolean
}

export const OrganizationContext = createContext<OrganizationContextType>({
  organizations: [],
  currentOrganization: null,
  setCurrentOrganization: () => {},
  switchOrganization: () => {},
  refreshOrganizations: async () => {},
  isLoading: true
})

export const useOrganization = () => useContext(OrganizationContext)

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const session = await getSession() as AppSession | null;
        if (!session?.user?.id) {
          console.warn('No user ID found in session');
          setIsLoading(false);
          return;
        }

        const response = await getOrganizationsApi({ userId: session.user.id });
        setOrganizations(response.organizations);
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganizations();
  }, []);

  useEffect(() => {
    const initializeCurrentOrganization = () => {
      const storedOrganizationId = localStorage.getItem('currentOrganizationId')
      
      if (storedOrganizationId) {
        const storedOrganization = organizations.find(w => w.id === storedOrganizationId)
        if (storedOrganization && !currentOrganization) {
          setCurrentOrganization(storedOrganization)
          return
        }
      }
      
      if (organizations.length > 0 && !currentOrganization) {
        setCurrentOrganization(organizations[0])
        localStorage.setItem('currentOrganizationId', organizations[0].id)
      }
    }

    initializeCurrentOrganization()
  }, [organizations, currentOrganization])

  const switchOrganization = (organizationId: string) => {
    const organization = organizations.find(w => w.id === organizationId)
    if (organization) {
      setCurrentOrganization(organization)
      localStorage.setItem('currentOrganizationId', organizationId)
    }
  }

  const refreshOrganizations = async () => {
    try {
      const session = await getSession() as AppSession | null;
      if (!session?.user?.id) {
        console.warn('No user ID found in session');
        return;
      }

      const response = await getOrganizationsApi({ userId: session.user.id });
      setOrganizations(response.organizations);
      
      if (currentOrganization) {
        const updatedOrganization = response.organizations.find(w => w.id === currentOrganization.id);
        if (updatedOrganization) {
          setCurrentOrganization(updatedOrganization);
        }
      }
    } catch (error) {
      console.error('Failed to refresh organizations:', error);
    }
  }

  return (
    <OrganizationContext.Provider value={{
      organizations,
      currentOrganization,
      setCurrentOrganization,
      switchOrganization,
      refreshOrganizations,
      isLoading
    }}>
      {children}
    </OrganizationContext.Provider>
  )
} 