'use client'

import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent } from '@mui/material';
import { getUsersApi } from '@/utils/api';
import { UserResponse } from '@/types/index';
import debounce from 'lodash/debounce';
import { toast } from 'react-hot-toast';

interface UserAddToOrgModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (userId: string) => Promise<void>;
  organizationId: string;
}

const UserAddToOrgModal: React.FC<UserAddToOrgModalProps> = ({
  open,
  onClose,
  onAdd,
  organizationId
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search function
  const searchUsers = useCallback(
    debounce(async (query: string) => {
      if (!query) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await getUsersApi();
        const filteredUsers = response.users.filter(user =>
          user.email.toLowerCase().includes(query.toLowerCase()) ||
          (user.name && user.name.toLowerCase().includes(query.toLowerCase()))
        );
        setSearchResults(filteredUsers);
      } catch (error) {
        console.error('Failed to search users:', error);
        toast.error('Failed to search users');
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    searchUsers(searchQuery);
    return () => searchUsers.cancel();
  }, [searchQuery, searchUsers]);

  const handleSelectUser = async (userId: string) => {
    try {
      await onAdd(userId);
      toast.success('User added successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to add user');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Existing User</DialogTitle>
      <DialogContent>
        <div className="mt-4">
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search users by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />

          <div className="mt-4 max-h-96 overflow-y-auto">
            {isSearching ? (
              <div className="text-gray-500 p-4">Searching...</div>
            ) : searchResults.length > 0 ? (
              <div className="divide-y">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user.id)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{user.name || 'Unnamed User'}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                    <span className="text-blue-600">Add</span>
                  </button>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="text-gray-500 p-4">No users found</div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserAddToOrgModal; 