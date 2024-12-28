'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getUsersApi, deleteUserApi, UserResponse } from '@/utils/api';
import { isAxiosError } from 'axios';
import colors from 'tailwindcss/colors';
import { useRouter } from 'next/navigation';

const UserManager: React.FC = () => {
  const router = useRouter();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 10,
    page: 0,
  });

  const fetchUsers = useCallback(async () => {
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
  }, [paginationModel]);

  useEffect(() => {
    fetchUsers();
  }, [paginationModel, fetchUsers]);

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await deleteUserApi(userId);
      // Refresh the user list
      fetchUsers();
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMessage = error.response?.data?.detail || 'Failed to delete user';
        alert(errorMessage);
      }
    }
  };

  const columns: GridColDef[] = [
    { field: 'email', headerName: 'Email', flex: 1 },
    { field: 'name', headerName: 'Name', flex: 1 },
    { 
      field: 'role', 
      headerName: 'Role', 
      width: 100,
      renderCell: ({ value }) => (
        <span className={`px-2 py-1 rounded-full text-sm ${
          value === 'admin' 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
    { 
      field: 'emailVerified', 
      headerName: 'Verified', 
      width: 100,
      renderCell: ({ value }) => (
        <span>{value ? 'Yes' : 'No'}</span>
      )
    },
    { 
      field: 'createdAt', 
      headerName: 'Created', 
      flex: 1,
      renderCell: ({ value }) => (
        <span>{new Date(value).toLocaleDateString()}</span>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: ({ row }) => (
        <div className="flex gap-2">
          <IconButton
            onClick={() => router.push(`/settings/admin/users/${row.id}`)}
            className="text-blue-600 hover:bg-blue-50"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() => handleDeleteUser(row.id)}
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Users</h2>
      </div>

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
              padding: 'px',
            },
            '& .MuiDataGrid-row:nth-of-type(odd)': {
              backgroundColor: colors.gray[100],
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: `${colors.gray[200]} !important`,
            }
          }}
        />
      </div>

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