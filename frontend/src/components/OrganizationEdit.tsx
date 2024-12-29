'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Organization, OrganizationMember } from '@/app/types/Api'
import { getOrganizationsApi, updateOrganizationApi, getUsersApi } from '@/utils/api'
import { isAxiosError } from 'axios'
import { useOrganization } from '@/contexts/OrganizationContext'
import { UserResponse } from '@/utils/api'
import { 
  DataGrid, 
  GridColDef, 
  GridRenderCellParams 
} from '@mui/x-data-grid'
import { Switch, IconButton } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'

interface OrganizationEditProps {
  organizationId: string
}

interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (userId: string) => void;
  availableUsers: UserResponse[];
  currentMembers: OrganizationMember[];
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ 
  open, 
  onClose, 
  onAdd, 
  availableUsers,
  currentMembers 
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter users not in organization
  const filteredUsers = availableUsers.filter(user => 
    !currentMembers.some(member => member.user_id === user.id) && 
    (searchQuery === '' || // Only apply name/email filter if there's a search query
     user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  ).slice(0, 10); // Limit to first 10 users

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

const OrganizationEdit: React.FC<OrganizationEditProps> = ({ organizationId }) => {
  const router = useRouter()
  const { refreshOrganizations } = useOrganization()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [name, setName] = useState('')
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [availableUsers, setAvailableUsers] = useState<UserResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [originalName, setOriginalName] = useState('')
  const [originalMembers, setOriginalMembers] = useState<OrganizationMember[]>([])

  // Filter current organization members
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
        const [organizationsResponse, usersResponse] = await Promise.all([
          getOrganizationsApi(),
          getUsersApi()
        ])
        
        const organization = organizationsResponse.organizations.find(o => o.id === organizationId)
        if (organization) {
          setOrganization(organization)
          setName(organization.name)
          setMembers(organization.members)
          // Store original values
          setOriginalName(organization.name)
          setOriginalMembers(organization.members)
        } else {
          setError('Organization not found')
        }
        
        setAvailableUsers(usersResponse.users)
      } catch (err) {
        setError('Failed to load organization data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    try {
      await updateOrganizationApi(organizationId, { 
        name,
        members 
      })
      setSuccess(true)
      await refreshOrganizations()
      // Update original values after successful save
      setOriginalName(name)
      setOriginalMembers(members)
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to update organization')
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
      headerName: 'User',
      flex: 1,
      minWidth: 300,
      renderCell: (params: GridRenderCellParams) => (
        <button
          onClick={() => router.push(`/settings/account/users/${params.row.id}`)}
          className="text-left hover:text-blue-600 focus:outline-none"
        >
          <span className="font-medium">{params.value}</span>
          <span className="text-gray-500 ml-2">({params.row.email})</span>
        </button>
      )
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

  // Check if form has changes
  const hasChanges = () => {
    if (name !== originalName) return true
    if (members.length !== originalMembers.length) return true
    
    // Compare each member and their roles
    const memberChanges = members.some(member => {
      const originalMember = originalMembers.find(m => m.user_id === member.user_id)
      return !originalMember || originalMember.role !== member.role
    })
    
    return memberChanges
  }

  if (loading) {
    return <div className="flex items-center justify-center p-4">Loading...</div>
  }

  if (!organization) {
    return <div className="flex items-center justify-center p-4">Organization not found</div>
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
      <div className="flex flex-col h-[calc(100vh-200px)]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Edit Organization</h2>
          <div className="flex gap-4">
            <button
              type="submit"
              form="organization-form"
              disabled={!hasChanges()}
              className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${hasChanges() 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => router.push('/settings/account/organizations')}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
        
        <form id="organization-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">Organization updated successfully</span>
            </div>
          )}

          {/* Organization Name Section */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
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

export default OrganizationEdit 