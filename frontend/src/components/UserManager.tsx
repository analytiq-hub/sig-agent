'use client'

import React, { useState, useEffect } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getUsersApi, isAxiosError, UserResponse } from '@/utils/api';
import colors from 'tailwindcss/colors';

const UserManager: React.FC = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 10,
    page: 0,
  });

  const fetchUsers = async () => {
    try {
      const response = await getUsersApi({
        skip: paginationModel.page * paginationModel.pageSize,
        limit: paginationModel.pageSize
      });
      setUsers(response.users);
      setTotalCount(response.total_count);
    } catch (error) {
      if (isAxiosError(error)) {
        console.error('Error fetching users:', error.response?.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [paginationModel]);

  const columns: GridColDef[] = [
    { field: 'email', headerName: 'Email', flex: 1 },
    { field: 'name', headerName: 'Name', flex: 1 },
    { 
      field: 'isAdmin', 
      headerName: 'Admin', 
      width: 100,
      renderCell: (params) => (
        <span>{params.value ? 'Yes' : 'No'}</span>
      )
    },
    { 
      field: 'emailVerified', 
      headerName: 'Verified', 
      width: 100,
      renderCell: (params) => (
        <span>{params.value ? 'Yes' : 'No'}</span>
      )
    },
    { 
      field: 'createdAt', 
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
        <div className="flex gap-2">
          <IconButton
            onClick={() => {/* TODO: Implement edit */}}
            className="text-blue-600 hover:bg-blue-50"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() => {/* TODO: Implement delete */}}
            className="text-red-600 hover:bg-red-50"
          >
            <DeleteIcon />
          </IconButton>
        </div>
      ),
    },
  ];

  // Calculate the current range for status text
  const startRange = (paginationModel.page * paginationModel.pageSize) + 1;
  const endRange = Math.min(startRange + users.length - 1, totalCount);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div style={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={users}
          columns={columns}
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50]}
          paginationMode="server"
          rowCount={totalCount}
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
          sx={{
            '& .MuiDataGrid-cell': {
              padding: '8px',
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
          totalCount > 0 ? 
            `Showing ${startRange}-${endRange} of ${totalCount} users` : 
            'No users found'
        }
      </div>
    </div>
  );
};

export default UserManager; 