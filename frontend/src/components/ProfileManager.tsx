'use client'

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { TextField, Button, Paper, Alert, Snackbar } from '@mui/material';

const ProfileManager: React.FC = () => {
  const { data: session, update } = useSession();
  const [displayName, setDisplayName] = useState(session?.user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpdateProfile = async () => {
    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });

      if (response.ok) {
        setSuccess('Profile updated successfully');
        update(); // Update the session data
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      setError('Failed to update profile');
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        setSuccess('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        throw new Error('Failed to update password');
      }
    } catch (error) {
      setError('Failed to update password');
    }
  };

  return (
    <div className="space-y-6">
      <Paper className="p-6">
        <h2 className="text-xl font-semibold mb-4">Display Name</h2>
        <div className="space-y-4">
          <TextField
            fullWidth
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleUpdateProfile}
          >
            Update Profile
          </Button>
        </div>
      </Paper>

      <Paper className="p-6">
        <h2 className="text-xl font-semibold mb-4">Change Password</h2>
        <div className="space-y-4">
          <TextField
            fullWidth
            type="password"
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <TextField
            fullWidth
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <TextField
            fullWidth
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleUpdatePassword}
          >
            Change Password
          </Button>
        </div>
      </Paper>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      </Snackbar>
      
      <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess(null)}>
        <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>
      </Snackbar>
    </div>
  );
};

export default ProfileManager;
