'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
import { Button, Divider } from '@mui/material';

const SettingsPage: React.FC = () => {
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);

  const renderContent = () => {
    switch (selectedMenu) {
      case 'system_development':
        return (
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
        );
      case 'user_developer':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Access tokens</h2>
                <p className="text-gray-600 mb-2">
                  Use Access Tokens to authenticate with our API.
                </p>
              </div>
              <Link href="/settings/user/developer" passHref>
                <Button variant="contained" color="primary">
                  Manage
                </Button>
              </Link>
            </div>
          </div>
        );
      default:
        return (
          <>
            <h2 className="text-xl mb-4">Settings Overview</h2>
            <p>Select a settings category from the menu to get started.</p>
          </>
        );
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow">
          <nav className="flex flex-col">
            <div className="p-4">
              <div className="flex items-center gap-2 text-gray-400 font-medium mb-2">
                <AdminPanelSettingsIcon className="w-5 h-5" />
                <span>Admin Settings</span>
              </div>
              
              <div className="ml-4 space-y-1">
                <button
                  onClick={() => setSelectedMenu('system_development')}
                  className={`w-full text-left px-4 py-2 rounded-md transition-colors
                    ${selectedMenu === 'system_development' 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'hover:bg-gray-100 text-gray-700'
                    }`}
                >
                  Development
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 my-2"></div>

            <div className="p-4">
              <div className="flex items-center gap-2 text-gray-400 font-medium mb-2">
                <PersonIcon className="w-5 h-5" />
                <span>User Settings</span>
              </div>
              
              <div className="ml-4 space-y-1">
                <button
                  onClick={() => setSelectedMenu('user_developer')}
                  className={`w-full text-left px-4 py-2 rounded-md transition-colors
                    ${selectedMenu === 'user_developer' 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'hover:bg-gray-100 text-gray-700'
                    }`}
                >
                  Developer
                </button>
                
                <Link 
                  href="/settings/user/profile"
                  className="block w-full text-left px-4 py-2 rounded-md transition-colors
                    hover:bg-gray-100 text-gray-700"
                >
                  Profile
                </Link>
              </div>
            </div>
          </nav>
        </div>
        
        <div className="md:col-span-3">
          <div className="bg-white rounded-lg shadow p-4">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
