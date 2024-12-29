export interface WorkspaceMember {
  user_id: string;
  role: 'admin' | 'user';
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  members: WorkspaceMember[];
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