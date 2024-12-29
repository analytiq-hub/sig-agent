'use client'

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
import { Button, Divider } from '@mui/material';
import { useSession } from 'next-auth/react';
import RoleBasedRender from './RoleBasedRender';

interface SettingsLayoutProps {
  selectedMenu?: string;
  children?: React.ReactNode;
}

const SettingsLayout: React.FC<SettingsLayoutProps> = ({ 
  selectedMenu = 'user_developer',
  children
}) => {
  const router = useRouter();
  const { data: session } = useSession();
  console.log('Session in SettingsLayout:', session);

  const renderContent = () => {
    if (children) {
      return children;
    }

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
              <Link href="/settings/account/development/llm-tokens" passHref>
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
                  Configure your AWS access keys.
                </p>
              </div>
              <Link href="/settings/account/development/aws-credentials" passHref>
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
                <h2 className="text-xl font-semibold">Access Tokens</h2>
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
            <RoleBasedRender allowedRoles={["admin"]}>
              <div className="p-4">
                <div className="flex items-center gap-2 text-gray-400 font-medium mb-2">
                  <AdminPanelSettingsIcon className="w-5 h-5" />
                  <span>Account Settings</span>
                </div>
                
                <div className="ml-4 space-y-1">
                  <button
                    onClick={() => router.push('/settings/account/development')}
                    className={`w-full text-left px-4 py-2 rounded-md transition-colors
                      ${selectedMenu === 'system_development' 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'hover:bg-gray-100 text-gray-700'
                      }`}
                  >
                    Development
                  </button>
                  
                  <button
                    onClick={() => router.push('/settings/account/users')}
                    className={`w-full text-left px-4 py-2 rounded-md transition-colors
                      ${selectedMenu === 'system_users' 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'hover:bg-gray-100 text-gray-700'
                      }`}
                  >
                    Users
                  </button>

                  <button
                    onClick={() => router.push('/settings/account/organizations')}
                    className={`w-full text-left px-4 py-2 rounded-md transition-colors
                      ${selectedMenu === 'system_organizations' 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'hover:bg-gray-100 text-gray-700'
                      }`}
                  >
                    Organizations
                  </button>
                </div>
              </div>
            </RoleBasedRender>

            <div className="border-t border-gray-200 my-2"></div>

            <div className="p-4">
              <div className="flex items-center gap-2 text-gray-400 font-medium mb-2">
                <PersonIcon className="w-5 h-5" />
                <span>User Settings</span>
              </div>
              
              <div className="ml-4 space-y-1">
                <button
                  onClick={() => router.push('/settings/user/developer')}
                  className={`w-full text-left px-4 py-2 rounded-md transition-colors
                    ${selectedMenu === 'user_developer' 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'hover:bg-gray-100 text-gray-700'
                    }`}
                >
                  Developer
                </button>
                
                <button
                  onClick={() => router.push('/settings/user/profile')}
                  className={`w-full text-left px-4 py-2 rounded-md transition-colors
                    ${selectedMenu === 'user_profile' 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'hover:bg-gray-100 text-gray-700'
                    }`}
                >
                  Profile
                </button>
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

export default SettingsLayout; 