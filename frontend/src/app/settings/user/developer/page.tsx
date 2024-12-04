'use client'

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import Link from 'next/link';
import { Button } from '@mui/material';

const DeveloperPage: React.FC = () => {
  return (
    <SettingsLayout selectedMenu="user_developer">
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">Access Tokens</h2>
            <p className="text-gray-600 mb-2">
              Use Access Tokens to authenticate with our API.
            </p>
          </div>
          <Link href="/settings/user/developer/access-tokens" passHref>
            <Button variant="contained" color="primary">
              Manage
            </Button>
          </Link>
        </div>
      </div>
    </SettingsLayout>
  );
};

export default DeveloperPage;
