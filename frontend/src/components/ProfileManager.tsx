'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { useSession } from 'next-auth/react';

const ProfileManager: React.FC = () => {
  const { data: session, update } = useSession();
  const [openNameModal, setOpenNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  
  const handleUpdateName = async () => {
    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      
      // Update the session with new name
      await update({
        ...session,
        user: {
          ...session?.user,
          name: newName
        }
      });

      setOpenNameModal(false);
      setNewName('');
    } catch (error) {
      console.error('Error updating name:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold">Display Name</h2>
          <p className="text-gray-600 mb-2">
            {session?.user?.name || 'Not set'}
          </p>
        </div>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => setOpenNameModal(true)}
        >
          Change
        </Button>
      </div>

      <Divider />

      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold">Password</h2>
          <p className="text-gray-600 mb-2">
            Update your password.
          </p>
        </div>
        <Link href="/settings/user/profile/security" passHref>
          <Button variant="contained" color="primary">
            Change
          </Button>
        </Link>
      </div>

      <Dialog open={openNameModal} onClose={() => setOpenNameModal(false)}>
        <DialogTitle>Change Display Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="New Display Name"
            fullWidth
            variant="outlined"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNameModal(false)}>Cancel</Button>
          <Button 
            onClick={handleUpdateName} 
            variant="contained" 
            color="primary"
            disabled={!newName.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ProfileManager;

