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
    <div className="bg-white rounded-lg shadow p-6">
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

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Workspace Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Members</h3>
            <div className="mt-4 space-y-4">
              {members.map(member => {
                const user = availableUsers.find(u => u.id === member.user_id)
                return (
                  <div key={member.user_id} className="flex items-center justify-between p-2 border rounded">
                    <span>{user?.name || user?.email || member.user_id}</span>
                    <div className="flex items-center gap-4">
                      <RadioGroup value={member.role} onChange={(value) => handleRoleChange(member.user_id, value)} className="flex gap-4">
                        <RadioGroup.Option value="user">
                          {({ checked }) => (
                            <div className={`flex items-center gap-2 ${checked ? 'text-indigo-600' : 'text-gray-500'}`}>
                              <input
                                type="radio"
                                checked={checked}
                                className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                readOnly
                              />
                              <span>User</span>
                            </div>
                          )}
                        </RadioGroup.Option>
                        <RadioGroup.Option value="admin">
                          {({ checked }) => (
                            <div className={`flex items-center gap-2 ${checked ? 'text-indigo-600' : 'text-gray-500'}`}>
                              <input
                                type="radio"
                                checked={checked}
                                className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                readOnly
                              />
                              <span>Admin</span>
                            </div>
                          )}
                        </RadioGroup.Option>
                      </RadioGroup>
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

            <div className="mt-4">
              <label htmlFor="user-search" className="block text-sm font-medium text-gray-700">
                Add Member
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  id="user-search"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Search users by name or email"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && filteredUsers.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {filteredUsers.slice(0, 10).map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="relative w-full cursor-pointer select-none py-2 px-3 text-left hover:bg-gray-100"
                        onClick={() => {
                          handleAddMember(user.id)
                          setSearchQuery('')
                        }}
                      >
                        <div className="flex items-center">
                          <span className="font-medium">{user.name}</span>
                          <span className="ml-2 text-sm text-gray-500">{user.email}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Save Changes
          </button>
          <button
            type="button"
            onClick={() => router.push('/settings/account/workspaces')}
            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default WorkspaceEdit 