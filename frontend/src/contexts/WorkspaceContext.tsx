'use client'

import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Workspace } from '@/app/types/Api';
import { getAllWorkspacesApi } from '@/utils/api';

type WorkspaceRole = 'owner' | 'admin' | 'member';

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const initialLoadDone = useRef(false);

  const refreshWorkspaces = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId || isRefreshing) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsRefreshing(true);
      console.log('Fetching workspaces...');
      const data = await getAllWorkspacesApi(userId);
      console.log('Fetched workspaces:', data);
      
      setWorkspaces(data.workspaces);
      
      if (!currentWorkspace && data.workspaces.length > 0) {
        const firstWorkspace = data.workspaces[0];
        setCurrentWorkspace(firstWorkspace);
        const member = firstWorkspace.members.find(m => m.user_id === userId);
        setUserRole(member?.role || null);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentWorkspace, isRefreshing, session?.user?.id]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) {
      console.error('Workspace not found:', workspaceId);
      return;
    }
    
    setCurrentWorkspace(workspace);
    const member = workspace.members.find(m => m.user_id === session?.user?.id);
    setUserRole(member?.role || null);
    localStorage.setItem('lastWorkspaceId', workspaceId);
  }, [workspaces, session]);

  const initialLoad = useCallback(() => {
    if (session?.user?.id && !initialLoadDone.current) {
      console.log('Initial workspace load');
      initialLoadDone.current = true;
      refreshWorkspaces();
    }
  }, [session?.user?.id, refreshWorkspaces]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

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
  }, [workspaces, switchWorkspace]);

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