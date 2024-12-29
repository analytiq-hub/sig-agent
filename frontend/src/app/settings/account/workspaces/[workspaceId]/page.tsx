'use client'

import { useParams } from 'next/navigation'
import WorkspaceEdit from '@/components/WorkspaceEdit'
import SettingsLayout from '@/components/SettingsLayout'

export default function WorkspaceEditPage() {
  const params = useParams()
  const workspaceId = params.workspaceId as string

  return (
    <SettingsLayout selectedMenu="system_workspaces">
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Edit Workspace</h1>
        <WorkspaceEdit workspaceId={workspaceId} />
      </div>
    </SettingsLayout>
  )
} 