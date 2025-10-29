'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { SigAgentAccountApi } from '@/utils/api';
import { User } from '@sigagent/sdk';
import { toast } from 'react-toastify';

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
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sigAgentAccountApi = useMemo(() => new SigAgentAccountApi(), []);

  useEffect(() => {
    if (!email) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      sigAgentAccountApi.listUsers({ limit: 1000 })
        .then(response => {
          const filteredUsers = response.users.filter(user =>
            !currentMembers.includes(user.id) && (
              user.email.toLowerCase().includes(email.toLowerCase()) ||
              (user.name && user.name.toLowerCase().includes(email.toLowerCase()))
            )
          );
          setSearchResults(filteredUsers);
        })
        .catch(error => {
          console.error('Failed to search users:', error);
        });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [email, currentMembers, sigAgentAccountApi]);

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
      } else {
        await sigAgentAccountApi.createInvitation({
          email,
          organization_id: organizationId,
          role: 'user'
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