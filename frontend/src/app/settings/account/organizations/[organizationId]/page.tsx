'use client'

import { useParams } from 'next/navigation'
import OrganizationEdit from '@/components/OrganizationEdit'
import SettingsLayout from '@/components/SettingsLayout'

export default function OrganizationEditPage() {
  const params = useParams()
  const organizationId = params.organizationId as string

  return (
    <SettingsLayout selectedMenu="system_organizations">
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Edit Organization</h1>
        <OrganizationEdit organizationId={organizationId} />
      </div>
    </SettingsLayout>
  )
} 