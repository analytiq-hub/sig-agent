'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Workspace, WorkspaceMember } from '@/app/types/Api'
import { getWorkspacesApi, updateWorkspaceApi, getUsersApi } from '@/utils/api'
import { isAxiosError } from 'axios'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { UserResponse } from '@/utils/api'
import { 
  DataGrid, 
  GridColDef, 
  GridRenderCellParams 
} from '@mui/x-data-grid'
import { Switch, IconButton } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'

interface WorkspaceEditProps {
  workspaceId: string
}

interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (userId: string) => void;
  availableUsers: UserResponse[];
  currentMembers: WorkspaceMember[];
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ 
  open, 
  onClose, 
  onAdd, 
  availableUsers,
  currentMembers 
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter users not in workspace
  const filteredUsers = availableUsers.filter(user => 
    !currentMembers.some(member => member.user_id === user.id) && 
    (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Member</DialogTitle>
      <DialogContent>
        <div className="mt-4">
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Search users by name or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <div className="mt-4 max-h-[400px] overflow-auto">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between border-b"
                onClick={() => {
                  onAdd(user.id);
                  onClose();
                }}
              >
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
                <span className="text-blue-600">Add</span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
      <DialogActions className="p-4">
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

const WorkspaceEdit: React.FC<WorkspaceEditProps> = ({ workspaceId }) => {
  const router = useRouter()
  const { refreshWorkspaces } = useWorkspace()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [name, setName] = useState('')
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [availableUsers, setAvailableUsers] = useState<UserResponse[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Filter users based on search query
  const filteredUsers = availableUsers.filter(user => 
    !members.some(member => member.user_id === user.id) && 
    (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Filter current workspace members
  const filteredMembers = members.filter(member => {
    const user = availableUsers.find(u => u.id === member.user_id);
    return user && (
      user.name?.toLowerCase().includes(memberSearch.toLowerCase()) || 
      user.email.toLowerCase().includes(memberSearch.toLowerCase())
    );
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [workspacesResponse, usersResponse] = await Promise.all([
          getWorkspacesApi(),
          getUsersApi()
        ])
        
        const workspace = workspacesResponse.workspaces.find(w => w.id === workspaceId)
        if (workspace) {
          setWorkspace(workspace)
          setName(workspace.name)
          setMembers(workspace.members)
        } else {
          setError('Workspace not found')
        }
        
        setAvailableUsers(usersResponse.users)
      } catch (err) {
        setError('Failed to load workspace data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [workspaceId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    try {
      await updateWorkspaceApi(workspaceId, { 
        name,
        members 
      })
      setSuccess(true)
      await refreshWorkspaces()
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to update workspace')
      } else {
        setError('An unexpected error occurred')
      }
    }
  }

  const handleRoleChange = (userId: string, newRole: 'admin' | 'user') => {
    setMembers(prevMembers => {
      const updatedMembers = prevMembers.map(member => 
        member.user_id === userId ? { ...member, role: newRole } : member
      )
      return updatedMembers
    })
  }

  const handleAddMember = (userId: string) => {
    if (!members.some(member => member.user_id === userId)) {
      setMembers(prev => [...prev, { user_id: userId, role: 'user' }])
    }
  }

  const handleRemoveMember = (userId: string) => {
    setMembers(prev => prev.filter(member => member.user_id !== userId))
  }

  // Update getGridRows to use filtered members
  const getGridRows = () => {
    return filteredMembers.map(member => {
      const user = availableUsers.find(u => u.id === member.user_id)
      return {
        id: member.user_id,
        name: user?.name || 'Unknown User',
        email: user?.email || '',
        isAdmin: member.role === 'admin'
      }
    })
  }

  // Define columns for the grid
  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      minWidth: 200
    },
    {
      field: 'isAdmin',
      headerName: 'Admin',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Switch
          checked={params.value}
          onChange={(e) => handleRoleChange(params.row.id, e.target.checked ? 'admin' : 'user')}
          color="primary"
        />
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton
          onClick={() => handleRemoveMember(params.row.id)}
          size="small"
        >
          <DeleteIcon />
        </IconButton>
      )
    }
  ]

  if (loading) {
    return <div className="flex items-center justify-center p-4">Loading...</div>
  }

  if (!workspace) {
    return <div className="flex items-center justify-center p-4">Workspace not found</div>
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
      <div className="flex flex-col h-[calc(100vh-200px)]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Edit Workspace</h2>
          <div className="flex gap-4">
            <button
              type="submit"
              form="workspace-form"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => router.push('/settings/account/workspaces')}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
        
        <form id="workspace-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">Workspace updated successfully</span>
            </div>
          )}

          {/* Workspace Name Section */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Workspace Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Members Section */}
          <div className="flex-1 min-h-0 bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Members</h3>
              
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Add Member
              </button>
            </div>

            {/* Search current members */}
            <div className="mb-4">
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Search members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>

            {/* Members Table */}
            <div className="h-[calc(100%-130px)] bg-white rounded-lg">
              <DataGrid
                rows={getGridRows()}
                columns={columns}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 5 }
                  }
                }}
                pageSizeOptions={[5, 10, 20]}
                disableRowSelectionOnClick
                disableColumnMenu
                density="standard"
                sx={{
                  '& .MuiDataGrid-row': {
                    height: '60px'
                  },
                  '& .MuiDataGrid-row:nth-of-type(odd)': {
                    backgroundColor: '#f9fafb'
                  },
                  '& .MuiDataGrid-cell': {
                    height: '60px',
                    alignItems: 'center',
                    padding: '0 16px'
                  },
                  '& .MuiDataGrid-root': {
                    height: '100%'
                  }
                }}
              />
            </div>
          </div>
        </form>
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddMember}
        availableUsers={availableUsers}
        currentMembers={members}
      />
    </div>
  )
}

export default WorkspaceEdit 