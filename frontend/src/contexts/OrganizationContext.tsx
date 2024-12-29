'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { getOrganizationsApi } from '@/utils/api'
import { Organization } from '@/app/types/Api'

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

  const switchOrganization = (organizationId: string) => {
    const organization = organizations.find(w => w.id === organizationId)
    if (organization) {
      setCurrentOrganization(organization)
      localStorage.setItem('currentOrganizationId', organizationId)
    }
  }

  const refreshOrganizations = async () => {
    try {
      const response = await getOrganizationsApi()
      setOrganizations(response.organizations)
      
      if (currentOrganization) {
        const updatedOrganization = response.organizations.find(w => w.id === currentOrganization.id)
        if (updatedOrganization) {
          setCurrentOrganization(updatedOrganization)
        }
      }
    } catch (error) {
      console.error('Failed to refresh organizations:', error)
    }
  }

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await getOrganizationsApi()
        setOrganizations(response.organizations)
        
        const storedOrganizationId = localStorage.getItem('currentOrganizationId')
        if (storedOrganizationId) {
          const storedOrganization = response.organizations.find(w => w.id === storedOrganizationId)
          if (storedOrganization) {
            setCurrentOrganization(storedOrganization)
            return
          }
        }
        
        if (response.organizations.length > 0 && !currentOrganization) {
          setCurrentOrganization(response.organizations[0])
          localStorage.setItem('currentOrganizationId', response.organizations[0].id)
        }
      } catch (error) {
        console.error('Failed to fetch organizations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrganizations()
  }, [currentOrganization])

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