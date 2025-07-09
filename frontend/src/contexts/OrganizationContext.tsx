'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getOrganizationsApi } from '@/utils/api'
import { Organization } from '@/types/index'
import { getSession } from 'next-auth/react'
import { AppSession } from '@/types/AppSession'
import { usePathname } from 'next/navigation'

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
  const pathname = usePathname()

  // Extract organization ID from pathname if we're on an organization-specific settings page
  const getOrganizationIdFromPath = useCallback(() => {
    const settingsMatch = pathname.match(/^\/settings\/organizations\/([^\/]+)/)
    return settingsMatch ? settingsMatch[1] : null
  }, [pathname])

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const session = await getSession() as AppSession | null;
        if (!session?.user?.id) {
          console.warn('No user ID found in session');
          setIsLoading(false);
          return;
        }

        // Fetch all organizations the user is a member of
        const response = await getOrganizationsApi({ userId: session.user.id });

        // Filtering logic based on page and user role
        let filtered: Organization[] = response.organizations;
        const isSysAdmin = session.user.role === 'admin';

        // If on settings/organizations page or a specific org settings page
        const isSettingsPage = pathname.startsWith('/settings/organizations');
        if (isSettingsPage) {
          if (isSysAdmin) {
            filtered = response.organizations;
          } else {
            filtered = response.organizations.filter(org =>
              org.members.some(m => m.user_id === session.user.id && m.role === 'admin')
            );
          }
        }
        // Otherwise, show all organizations where user is a member
        setOrganizations(filtered);
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganizations();
  }, [pathname]);

  useEffect(() => {
    const initializeCurrentOrganization = () => {
      // Check if we're on an organization-specific settings page
      const orgIdFromPath = getOrganizationIdFromPath()
      
      if (orgIdFromPath) {
        // Find the organization from the path in our organizations list
        const orgFromPath = organizations.find(org => org.id === orgIdFromPath)
        if (orgFromPath) {
          setCurrentOrganization(orgFromPath)
          localStorage.setItem('currentOrganizationId', orgFromPath.id)
          return
        }
      }

      // Fallback to stored organization or first available
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
  }, [organizations, currentOrganization, getOrganizationIdFromPath])

  const switchOrganization = useCallback((organizationId: string) => {
    const organization = organizations.find(w => w.id === organizationId)
    if (organization) {
      setCurrentOrganization(organization)
      localStorage.setItem('currentOrganizationId', organizationId)
      
      // If we're on an organization-specific settings page, update the URL
      const orgIdFromPath = getOrganizationIdFromPath()
      if (orgIdFromPath && orgIdFromPath !== organizationId) {
        // We're switching to a different organization while on a settings page
        // Redirect to the same settings page for the new organization
        const newPath = pathname.replace(`/settings/organizations/${orgIdFromPath}`, `/settings/organizations/${organizationId}`)
        window.location.href = newPath
      }
    }
  }, [organizations, getOrganizationIdFromPath, pathname])

  const refreshOrganizations = useCallback(async () => {
    try {
      const session = await getSession() as AppSession | null;
      if (!session?.user?.id) {
        console.warn('No user ID found in session');
        return;
      }

      const response = await getOrganizationsApi({ userId: session.user.id });
      
      // Re-apply filtering logic
      let filtered: Organization[] = response.organizations;
      const isSysAdmin = session.user.role === 'admin';
      const isSettingsPage = pathname.startsWith('/settings/organizations');
      
      if (isSettingsPage) {
        if (isSysAdmin) {
          filtered = response.organizations;
        } else {
          filtered = response.organizations.filter(org =>
            org.members.some(m => m.user_id === session.user.id && m.role === 'admin')
          );
        }
      }
      setOrganizations(filtered);
      
      if (currentOrganization) {
        const updatedOrganization = filtered.find(w => w.id === currentOrganization.id);
        if (updatedOrganization) {
          setCurrentOrganization(updatedOrganization);
        }
      }
    } catch (error) {
      console.error('Failed to refresh organizations:', error);
    }
  }, [pathname, currentOrganization])

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