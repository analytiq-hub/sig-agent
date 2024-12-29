'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Workspace, WorkspaceMember } from '@/app/types/Api'
import { getWorkspacesApi, updateWorkspaceApi, getUsersApi } from '@/utils/api'
import { isAxiosError } from 'axios'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { UserResponse } from '@/utils/api'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

  const handleRoleChange = (userId: string, newRole: 'admin' | 'member') => {
    setMembers(prevMembers => {
      const updatedMembers = prevMembers.map(member => 
        member.user_id === userId ? { ...member, role: newRole } : member
      )
      return updatedMembers
    })
  }

  const handleAddMember = (userId: string) => {
    if (!members.some(member => member.user_id === userId)) {
      setMembers(prev => [...prev, { user_id: userId, role: 'member' }])
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

          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900">Members</h3>
            <div className="mt-4 space-y-4">
              {members.map(member => {
                const user = availableUsers.find(u => u.id === member.user_id)
                return (
                  <div key={member.user_id} className="flex items-center justify-between p-2 border rounded">
                    <span>{user?.name || user?.email || member.user_id}</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.user_id, e.target.value as 'admin' | 'member')}
                        className="rounded border border-gray-300 px-2 py-1"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
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
              <label htmlFor="add-member" className="block text-sm font-medium text-gray-700">
                Add Member
              </label>
              <select
                id="add-member"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                onChange={(e) => {
                  if (e.target.value) handleAddMember(e.target.value)
                  e.target.value = '' // Reset selection
                }}
                value=""
              >
                <option value="">Select a user to add</option>
                {availableUsers
                  .filter(user => !members.some(member => member.user_id === user.id))
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </option>
                  ))}
              </select>
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