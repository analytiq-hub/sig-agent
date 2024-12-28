'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserApi, updateUserApi, UserResponse, UserUpdate } from '@/utils/api';
import { Button, TextField, FormControlLabel, Switch, Alert } from '@mui/material';

interface UserEditProps {
  userId: string;
}

const UserEdit: React.FC<UserEditProps> = ({ userId }) => {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('user');
  const [emailVerified, setEmailVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getUserApi(userId);
        setUser(userData);
        setName(userData.name || '');
        setRole(userData.role);
        setEmailVerified(userData.emailVerified || false);
      } catch (error) {
        setError('Failed to load user');
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      const update: UserUpdate = {
        name: name || undefined,
        role,
        emailVerified
      };

      await updateUserApi(userId, update);
      setSuccess(true);
    } catch (error) {
      setError('Failed to update user');
      console.error('Error updating user:', error);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Edit User</h2>
      
      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" className="mb-4">
          User updated successfully
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <TextField
            label="Email"
            value={user.email}
            disabled
            fullWidth
          />
        </div>

        <div>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
        </div>

        <div>
          <FormControlLabel
            control={
              <Switch
                checked={role === 'admin'}
                onChange={(e) => setRole(e.target.checked ? 'admin' : 'user')}
              />
            }
            label="Admin Role"
          />
        </div>

        <div>
          <FormControlLabel
            control={
              <Switch
                checked={emailVerified}
                onChange={(e) => setEmailVerified(e.target.checked)}
              />
            }
            label="Email Verified"
          />
        </div>

        <div className="flex gap-4">
          <Button
            type="submit"
            variant="contained"
            color="primary"
          >
            Save Changes
          </Button>
          <Button
            variant="outlined"
            onClick={() => router.push('/settings/admin/users')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default UserEdit; 