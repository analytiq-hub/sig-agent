'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { getWorkspacesApi } from '@/utils/api'
import { Workspace } from '@/app/types/Api'

interface WorkspaceContextType {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  setCurrentWorkspace: (workspace: Workspace) => void
  switchWorkspace: (workspaceId: string) => void
  refreshWorkspaces: () => Promise<void>
  isLoading: boolean
}

export const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  currentWorkspace: null,
  setCurrentWorkspace: () => {},
  switchWorkspace: () => {},
  refreshWorkspaces: async () => {},
  isLoading: true
})

export const useWorkspace = () => useContext(WorkspaceContext)

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const switchWorkspace = (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId)
    if (workspace) {
      setCurrentWorkspace(workspace)
      // You might want to store this in localStorage or similar
      localStorage.setItem('currentWorkspaceId', workspaceId)
    }
  }

  const refreshWorkspaces = async () => {
    try {
      const response = await getWorkspacesApi()
      setWorkspaces(response.workspaces)
      
      // If there's a current workspace, update it with the new data
      if (currentWorkspace) {
        const updatedWorkspace = response.workspaces.find(w => w.id === currentWorkspace.id)
        if (updatedWorkspace) {
          setCurrentWorkspace(updatedWorkspace)
        }
      }
    } catch (error) {
      console.error('Failed to refresh workspaces:', error)
    }
  }

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const response = await getWorkspacesApi()
        setWorkspaces(response.workspaces)
        
        // Check for stored workspace ID
        const storedWorkspaceId = localStorage.getItem('currentWorkspaceId')
        if (storedWorkspaceId) {
          const storedWorkspace = response.workspaces.find(w => w.id === storedWorkspaceId)
          if (storedWorkspace) {
            setCurrentWorkspace(storedWorkspace)
            return
          }
        }
        
        // Set the first workspace as current if none is selected
        if (response.workspaces.length > 0 && !currentWorkspace) {
          setCurrentWorkspace(response.workspaces[0])
          localStorage.setItem('currentWorkspaceId', response.workspaces[0].id)
        }
      } catch (error) {
        console.error('Failed to fetch workspaces:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchWorkspaces()
  }, [])

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      currentWorkspace,
      setCurrentWorkspace,
      switchWorkspace,
      refreshWorkspaces,
      isLoading
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
} 