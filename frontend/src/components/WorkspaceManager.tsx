'use client'

import React, { useState, useEffect } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getWorkspacesApi, deleteWorkspaceApi } from '@/utils/api';
import { Workspace } from '@/app/types/Api';
import colors from 'tailwindcss/colors';
import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation'

const WorkspaceManager: React.FC = () => {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    try {
      const response = await getWorkspacesApi();
      setWorkspaces(response.workspaces);
    } catch (error) {
      if (isAxiosError(error)) {
        console.error('Error fetching workspaces:', error.response?.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleDeleteClick = (workspaceId: string) => {
    setDeleteWorkspaceId(workspaceId);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteWorkspaceId) return;

    try {
      await deleteWorkspaceApi(deleteWorkspaceId);
      setWorkspaces(prevWorkspaces => 
        prevWorkspaces.filter(w => w.id !== deleteWorkspaceId)
      );
      setDeleteWorkspaceId(null);
    } catch (error) {
      if (isAxiosError(error)) {
        setError(error.response?.data?.detail || 'Failed to delete workspace');
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1 },
    { 
      field: 'members', 
      headerName: 'Members', 
      flex: 1,
      renderCell: (params) => (
        <span>{params.value.length} members</span>
      )
    },
    { 
      field: 'created_at', 
      headerName: 'Created', 
      flex: 1,
      renderCell: (params) => (
        <span>{new Date(params.value).toLocaleDateString()}</span>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: (params) => (
        <div className="flex gap-2 items-center h-full">
          <IconButton
            onClick={() => router.push(`/settings/account/workspaces/${params.row.id}`)}
            className="text-blue-600 hover:bg-blue-50"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() => handleDeleteClick(params.row.id)}
            className="text-red-600 hover:bg-red-50"
          >
            <DeleteIcon />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Workspaces</h2>
      </div>

      <div style={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={workspaces}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
          sx={{
            '& .MuiDataGrid-cell': {
              padding: 'px'
            },
            '& .MuiDataGrid-row:nth-of-type(odd)': {
              backgroundColor: colors.gray[100],
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: `${colors.gray[200]} !important`,
            },
          }}
        />
      </div>

      {/* Status Text */}
      <div className="mt-4 text-sm text-gray-600">
        {loading ? 'Loading...' : 
          workspaces.length > 0 ? 
            `Showing ${workspaces.length} workspaces` : 
            'No workspaces found'
        }
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteWorkspaceId)}
        onClose={() => setDeleteWorkspaceId(null)}
      >
        <DialogTitle>Delete Workspace</DialogTitle>
        <DialogContent>
          <p className="mt-2">
            Are you sure you want to delete this workspace? This action cannot be undone.
          </p>
        </DialogContent>
        <DialogActions className="p-4">
          <Button
            onClick={() => setDeleteWorkspaceId(null)}
            className="text-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            className="bg-red-600 text-white hover:bg-red-700"
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default WorkspaceManager; 