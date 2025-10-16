'use client'

import React from 'react';
import Link from 'next/link';
import { useAppSession } from '@/contexts/AppSessionContext';
import { 
  Person as UserIcon,
  Business as OrganizationsIcon,
  Settings as SystemIcon
} from '@mui/icons-material';

interface SettingsLayoutProps {
  selectedMenu?: string;
  children?: React.ReactNode;
}

interface MenuItem {
  name: string;
  href: string;
  id: string;
  adminOnly?: boolean;
}

const SettingsLayout: React.FC<SettingsLayoutProps> = ({ 
  selectedMenu = 'user_developer',
  children
}) => {
  const { session } = useAppSession();
  const isAdmin = session?.user?.role === 'admin';

  const menuItems: Array<{
    title: string;
    icon: React.ElementType;
    items: Array<MenuItem>;
  }> = [
    {
      title: 'User',
      icon: UserIcon,
      items: [
        {
          name: 'Profile',
          href: '/settings/user/profile',
          id: 'user_profile',
        },
        {
          name: 'Developer',
          href: '/settings/user/developer',
          id: 'user_developer',
        },
      ],
    },
    {
      title: 'Organizations',
      icon: OrganizationsIcon,
      items: [
        {
          name: 'Organizations',
          href: '/settings/organizations',
          id: 'organizations',
          adminOnly: false,
        },
      ],
    },
    {
      title: 'System',
      icon: SystemIcon,
      items: [
        {
          name: 'Users',
          href: '/settings/account/users',
          id: 'system_users',
          adminOnly: true,
        },
        {
          name: 'Development',
          href: '/settings/account/development',
          id: 'system_development',
          adminOnly: true,
        },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`
          bg-white
          w-24 md:w-64
          transition-all duration-200
          overflow-x-hidden
          max-w-[16rem] md:max-w-[16rem]
        `}
      >
        <nav className="h-full py-6">
          {menuItems.map((section) => {
            const visibleItems = section.items.filter(item => 
              !item.adminOnly || isAdmin
            );

            if (visibleItems.length === 0) return null;

            const Icon = section.icon;

            return (
              <div key={section.title} className="mb-6 last:mb-0">
                {/* Hide section header on small screens */}
                <h2 className="hidden md:flex px-2 md:px-6 mb-1 text-xs md:text-sm font-medium text-gray-500 items-center">
                  <span className="hidden md:inline-flex">
                    <Icon className="h-5 w-5 mr-2" />
                  </span>
                  {section.title}
                </h2>
                <div className="mt-1">
                  {visibleItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`
                        flex items-center h-10
                        pl-2 md:pl-[48px] pr-2 md:pr-4
                        text-xs md:text-sm font-medium
                        transition-colors duration-200 rounded-md mx-1 md:mx-2
                        truncate-md
                        ${selectedMenu === item.id
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-100'
                        }
                      `}
                      style={{ minWidth: 0 }}
                    >
                      <span className="truncate-md">{item.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto py-8 px-2 md:px-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default SettingsLayout;