export interface WorkspaceMember {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  members: WorkspaceMember[];
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  members?: WorkspaceMember[];
}

export interface ListWorkspacesResponse {
  workspaces: Workspace[];
}