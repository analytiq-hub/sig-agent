'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TextField, Button, Alert, Paper } from '@mui/material'
import { Workspace } from '@/app/types/Api'
import { getWorkspacesApi, updateWorkspaceApi } from '@/utils/api'
import { isAxiosError } from 'axios'

interface WorkspaceEditProps {
  workspaceId: string
}

const WorkspaceEdit: React.FC<WorkspaceEditProps> = ({ workspaceId }) => {
  const router = useRouter()
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
      router.refresh()
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to update workspace')
      } else {
        setError('An unexpected error occurred')
      }
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!workspace) {
    return <div>Workspace not found</div>
  }

  return (
    <Paper className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert severity="error" className="mb-4">
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" className="mb-4">
            Workspace updated successfully
          </Alert>
        )}

        <div>
          <TextField
            label="Workspace Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            variant="outlined"
          />
        </div>

        <div className="flex gap-4">
          <Button
            type="submit"
            variant="contained"
            color="primary"
          >
            Save Changes
          </Button>
          <Button
            variant="outlined"
            onClick={() => router.push('/settings/account/workspaces')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Paper>
  )
}

export default WorkspaceEdit 