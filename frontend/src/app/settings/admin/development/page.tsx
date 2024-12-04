'use client'

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import Link from 'next/link';
import { Button, Divider } from '@mui/material';

const DevelopmentPage: React.FC = () => {
  return (
    <SettingsLayout selectedMenu="system_development">
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">LLM tokens</h2>
            <p className="text-gray-600 mb-2">
              Manage your Large Language Model (LLM) API tokens.
            </p>
          </div>
          <Link href="/settings/admin/development/llm-tokens" passHref>
            <Button variant="contained" color="primary">
              Manage
            </Button>
          </Link>
        </div>

        <Divider />

        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">AWS Credentials</h2>
            <p className="text-gray-600 mb-2">
              Configure your AWS access keys and region settings.
            </p>
          </div>
          <Link href="/settings/admin/development/aws-credentials" passHref>
            <Button variant="contained" color="primary">
              Manage
            </Button>
          </Link>
        </div>
      </div>
    </SettingsLayout>
  );
};

export default DevelopmentPage;
