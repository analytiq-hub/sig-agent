'use client'

import React from 'react';
import Link from 'next/link';
import { Button } from '@mui/material';

const UserSettingsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">User Settings</h1>
      <p className="text-gray-600 mb-4">Manage your configuration</p>
      <hr className="mb-4 border-t-2" />
      
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold">Access tokens</h2>
          <p className="text-gray-600 mb-2">
            Use Access Tokens to authenticate with our API.
          </p>
        </div>
        <Link href="/settings/user/api-tokens" passHref>
          <Button variant="contained" color="secondary">
            Manage
          </Button>
        </Link>
      </div>

      <hr className="my-4 border-t-2" />

      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold">LLM tokens</h2>
          <p className="text-gray-600 mb-2">
            Manage your Large Language Model (LLM) API tokens.
          </p>
        </div>
        <Link href="/settings/user/llm-tokens" passHref>
          <Button variant="contained" color="secondary">
            Manage
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default UserSettingsPage;
