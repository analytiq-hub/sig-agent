'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getUsersApi, deleteUserApi, UserResponse } from '@/utils/api';
import { isAxiosError } from 'axios';
import colors from 'tailwindcss/colors';
import { useRouter } from 'next/navigation';
import { signOut, getSession } from 'next-auth/react';

interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserResponse | null;
  onConfirm: () => Promise<void>;
}

const DeleteUserModal: React.FC<DeleteUserModalProps> = ({ isOpen, onClose, user, onConfirm }) => {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-lg font-medium mb-4">Delete User</h3>
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete user &quot;{user.email}&quot;? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Delete User
          </button>
        </div>
      </div>
    </div>
  );
};

const UserManager: React.FC = () => {
  const router = useRouter();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserResponse | null>(null);
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

  const handleDeleteClick = (user: UserResponse) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      await deleteUserApi(userToDelete.id);
      
      // Check if deleting current user
      const session = await getSession();
      if (session?.user?.id === userToDelete.id) {
        // Sign out if deleting self
        signOut({ callbackUrl: '/signin' });
        return;
      }
      
      // Refresh the user list
      fetchUsers();
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMessage = error.response?.data?.detail || 'Failed to delete user';
        alert(errorMessage);
      }
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'User',
      flex: 1,
      minWidth: 300,
      renderCell: (params: GridRenderCellParams) => (
        <button
          onClick={() => router.push(`/settings/account/users/${params.row.id}`)}
          className="text-left hover:text-blue-600 focus:outline-none"
        >
          <span className="font-medium">{params.value || 'Unnamed User'}</span>
          <span className="text-gray-500 ml-2">({params.row.email})</span>
        </button>
      )
    },
    { 
      field: 'role', 
      headerName: 'Role', 
      width: 120,
      renderCell: (params) => (
        <span className={params.value === 'admin' ? 'text-blue-600' : ''}>
          {params.value}
        </span>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: (params) => (
        <div className="flex gap-2 items-center h-full">
          <IconButton
            onClick={() => router.push(`/settings/account/users/${params.row.id}`)}
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

      <DeleteUserModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        user={userToDelete}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default UserManager; 