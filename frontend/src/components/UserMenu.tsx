'use client'

import React, { useState } from 'react';
import { Settings as SettingsIcon, ExitToApp as SignoutIcon } from '@mui/icons-material';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | undefined;
}

const UserMenu: React.FC<UserMenuProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    signOut({
      callbackUrl: '/auth/signin'
    });
    setIsOpen(false);
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'U';
    return name.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative">
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center ml-2 rounded-full hover:ring-2 hover:ring-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
        title={user?.name || 'User'}
      >
        {user?.image ? (
          <Image
            src={user.image}
            alt={user.name || 'User'}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
            {getInitials(user?.name)}
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-40">
            {/* User Info */}
            <div className="px-4 py-3">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user?.name || 'User'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {user?.email || ''}
              </p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* Settings Link */}
            <Link
              href="/settings"
              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setIsOpen(false)}
            >
              <SettingsIcon className="h-4 w-4 mr-2" />
              Settings
            </Link>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <SignoutIcon className="h-4 w-4 mr-2" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UserMenu;