'use client'

import React from 'react';
import Link from 'next/link';
import { Button, Divider } from '@mui/material';
import { useSession } from 'next-auth/react';

const ProfileManager: React.FC = () => {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold">Display Name</h2>
          <p className="text-gray-600 mb-2">
          {session?.user?.name || 'Not set'}
          </p>
        </div>
          <Link href="/settings/user/profile/personal" passHref>
            <Button variant="contained" color="primary">
              Change
            </Button>
          </Link>
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
    </div>
  );
};

export default ProfileManager;

