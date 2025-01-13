'use client'

import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { getUsersApi, createInvitationApi } from '@/utils/api';
import { UserResponse } from '@/types/index';
import debounce from 'lodash/debounce';
import { toast } from 'react-hot-toast';

interface UserAddToOrgModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (userId: string) => Promise<void>;
  organizationId: string;
  currentMembers: string[];
}

const UserAddToOrgModal: React.FC<UserAddToOrgModalProps> = ({
  open,
  onClose,
  onAdd,
  organizationId,
  currentMembers
}) => {
  const [email, setEmail] = useState('');
  const [searchResults, setSearchResults] = useState<UserResponse[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query) {
        setSearchResults([]);
        return;
      }

      try {
        const response = await getUsersApi();
        const filteredUsers = response.users.filter(user =>
          !currentMembers.includes(user.id) && (
            user.email.toLowerCase().includes(query.toLowerCase()) ||
            (user.name && user.name.toLowerCase().includes(query.toLowerCase()))
          )
        );
        setSearchResults(filteredUsers);
      } catch (error) {
        console.error('Failed to search users:', error);
      }
    }, 500),
    [currentMembers]
  );

  useEffect(() => {
    debouncedSearch(email);
    return () => debouncedSearch.cancel();
  }, [email, debouncedSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      const existingUser = searchResults.find(
        user => user.email.toLowerCase() === email.toLowerCase()
      );

      if (existingUser) {
        await onAdd(existingUser.id);
        toast.success('User added successfully');
      } else {
        await createInvitationApi({
          email,
          organization_id: organizationId
        });
        toast.success('Invitation sent successfully');
      }
      onClose();
      setEmail('');
    } catch (error) {
      console.error('Failed to add user: ' + error);
      toast.error('Failed to add user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectUser = async (userId: string) => {
    try {
      await onAdd(userId);
      toast.success('User added successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to add user: ' + error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add User</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <div className="mt-4">
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter email address..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />

            {searchResults.length > 0 && (
              <div className="mt-4 max-h-96 overflow-y-auto border rounded-md divide-y">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
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
            )}
          </div>
        </DialogContent>
        <DialogActions className="p-4">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || !email}
          >
            {isSubmitting ? 'Adding...' : 'Add User'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserAddToOrgModal; 