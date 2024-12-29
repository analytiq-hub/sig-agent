'use client'

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import WorkspaceManager from '@/components/WorkspaceManager';

const WorkspacesPage: React.FC = () => {
  return (
    <SettingsLayout selectedMenu="system_workspaces">
      <div>
        <h2 className="text-xl font-semibold mb-4">Workspace Management</h2>
        <WorkspaceManager />
      </div>
    </SettingsLayout>
  );
};

export default WorkspacesPage; 