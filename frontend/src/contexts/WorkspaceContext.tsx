'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Workspace, WorkspaceRole } from '@/types/workspace';

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  workspaces: Workspace[];
  userRole: WorkspaceRole | null;
  isLoading: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userRole, setUserRole] = useState<WorkspaceRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshWorkspaces = async () => {
    if (!session?.user) {
      setIsLoading(false);
      return;
    }
    
    try {
      console.log('Fetching workspaces...');
      const response = await fetch('/api/workspaces');
      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Fetched workspaces:', data);
      
      setWorkspaces(data.workspaces);
      
      // If no current workspace is selected but we have workspaces, select the first one
      if (!currentWorkspace && data.workspaces.length > 0) {
        const firstWorkspace = data.workspaces[0];
        setCurrentWorkspace(firstWorkspace);
        // Set initial user role
        const member = firstWorkspace.members.find(m => m.userId === session.user.id);
        setUserRole(member?.role || null);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const switchWorkspace = async (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) {
      console.error('Workspace not found:', workspaceId);
      return;
    }
    
    setCurrentWorkspace(workspace);
    // Update user role for the new workspace
    const member = workspace.members.find(m => m.userId === session?.user?.id);
    setUserRole(member?.role || null);
    
    // Store the last selected workspace in localStorage
    localStorage.setItem('lastWorkspaceId', workspaceId);
  };

  // Initial fetch of workspaces when session is available
  useEffect(() => {
    if (session?.user) {
      console.log('Session available, refreshing workspaces');
      refreshWorkspaces();
    }
  }, [session]);

  // Restore last selected workspace from localStorage
  useEffect(() => {
    if (workspaces.length > 0) {
      const lastWorkspaceId = localStorage.getItem('lastWorkspaceId');
      if (lastWorkspaceId) {
        const workspace = workspaces.find(w => w.id === lastWorkspaceId);
        if (workspace) {
          switchWorkspace(lastWorkspaceId);
        }
      }
    }
  }, [workspaces]);

  const value = {
    currentWorkspace,
    setCurrentWorkspace,
    workspaces,
    userRole,
    isLoading,
    switchWorkspace,
    refreshWorkspaces
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
} 