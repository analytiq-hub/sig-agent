'use client'

import React from 'react';
import Link from 'next/link';

const SettingsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <p className="text-gray-600 mb-4">Manage your application settings</p>
      <Link href="/settings/user" className="text-blue-500 hover:underline">
        User Settings
      </Link>
    </div>
  );
};

export default SettingsPage;
