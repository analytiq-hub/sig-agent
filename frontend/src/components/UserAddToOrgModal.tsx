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
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNoResults, setShowNoResults] = useState(false);

  const searchUsers = useCallback((query: string) => {
    const search = debounce(async (q: string) => {
      if (!q) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await getUsersApi();
        const filteredUsers = response.users.filter(user =>
          !currentMembers.includes(user.id) && (
            user.email.toLowerCase().includes(q.toLowerCase()) ||
            (user.name && user.name.toLowerCase().includes(q.toLowerCase()))
          )
        );
        setSearchResults(filteredUsers);
      } catch (error) {
        console.error('Failed to search users:', error);
        toast.error('Failed to search users');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    search(query);
    return () => search.cancel();
  }, [currentMembers]);

  useEffect(() => {
    searchUsers(email);
  }, [email, searchUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowNoResults(!!email && !isSearching && searchResults.length === 0);
    }, 500);

    return () => clearTimeout(timer);
  }, [email, isSearching, searchResults.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      // Check if user exists in search results
      const existingUser = searchResults.find(
        user => user.email.toLowerCase() === email.toLowerCase()
      );

      if (existingUser) {
        // Add existing user
        await onAdd(existingUser.id);
        toast.success('User added successfully');
      } else {
        // Send invitation to new user
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

            <div className="mt-4 max-h-96 overflow-y-auto">
              {searchResults.length > 0 && (
                <div className="divide-y">
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