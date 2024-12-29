'use client'

import React, { useState, useEffect, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { Workspace } from '@/app/types/Api'
import { getWorkspacesApi, updateWorkspaceApi } from '@/utils/api'
import { isAxiosError } from 'axios'
import { WorkspaceContext } from '@/contexts/WorkspaceContext'

interface WorkspaceEditProps {
  workspaceId: string
}

const WorkspaceEdit: React.FC<WorkspaceEditProps> = ({ workspaceId }) => {
  const router = useRouter()
  const { refreshWorkspaces } = useContext(WorkspaceContext)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const response = await getWorkspacesApi()
        const workspace = response.workspaces.find(w => w.id === workspaceId)
        if (workspace) {
          setWorkspace(workspace)
          setName(workspace.name)
        } else {
          setError('Workspace not found')
        }
      } catch (err) {
        setError('Failed to load workspace')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchWorkspace()
  }, [workspaceId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    try {
      await updateWorkspaceApi(workspaceId, { name })
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