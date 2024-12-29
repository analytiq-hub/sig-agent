'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Workspace, WorkspaceMember } from '@/app/types/Api'
import { getWorkspacesApi, updateWorkspaceApi, getUsersApi } from '@/utils/api'
import { isAxiosError } from 'axios'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { UserResponse } from '@/utils/api'
import { RadioGroup } from '@headlessui/react'

interface WorkspaceEditProps {
  workspaceId: string
}

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

  // Filter users based on search query
  const filteredUsers = availableUsers.filter(user => 
    !members.some(member => member.user_id === user.id) && 
    (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

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

  if (loading) {
    return <div className="flex items-center justify-center p-4">Loading...</div>
  }

  if (!workspace) {
    return <div className="flex items-center justify-center p-4">Workspace not found</div>
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Edit Workspace</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">Workspace updated successfully</span>
          </div>
        )}

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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Members</h3>
          
          {/* Search and Add Members */}
          <div className="mb-6">
            <label htmlFor="user-search" className="block text-sm font-medium text-gray-700 mb-1">
              Add Member
            </label>
            <div className="relative">
              <input
                type="text"
                id="user-search"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search users by name or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && filteredUsers.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200">
                  {filteredUsers.slice(0, 10).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                      onClick={() => {
                        handleAddMember(user.id)
                        setSearchQuery('')
                      }}
                    >
                      <div>
                        <span className="font-medium">{user.name}</span>
                        <span className="ml-2 text-sm text-gray-500">{user.email}</span>
                      </div>
                      <span className="text-blue-600 text-sm">Add</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Members Grid */}
          <div className="grid gap-4">
            {members.map(member => {
              const user = availableUsers.find(u => u.id === member.user_id)
              return (
                <div 
                  key={member.user_id} 
                  className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 hover:bg-gray-100"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{user?.name || 'Unknown User'}</span>
                    <span className="text-sm text-gray-500">{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={member.role === 'admin'}
                          onChange={(e) => handleRoleChange(member.user_id, e.target.checked ? 'admin' : 'user')}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                      <span className="text-sm font-medium text-gray-700">Admin</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
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
      </form>
    </div>
  )
}

export default WorkspaceEdit 