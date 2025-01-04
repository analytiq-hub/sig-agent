'use client'

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

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
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const menuItems: Array<{
    title: string;
    items: Array<MenuItem>;
  }> = [
    {
      title: 'User',
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
      <aside className="w-64 border-r border-gray-200 bg-white">
        <nav className="p-6 space-y-8">
          {menuItems.map((section) => {
            // Filter out admin-only items for non-admin users
            const visibleItems = section.items.filter(item => 
              !item.adminOnly || isAdmin
            );

            // Only show sections that have visible items
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-2">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.title}
                </h2>
                <div className="space-y-1">
                  {visibleItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`
                        flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                        ${selectedMenu === item.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      {item.name}
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
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default SettingsLayout; 