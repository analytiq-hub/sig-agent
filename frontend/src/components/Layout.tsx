"use client"

import React, { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../utils/api/page';
import ErrorBoundary from './ErrorBoundary';

type LayoutProps = {
  children: ReactNode;
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col w-full">
      <nav className="bg-white shadow-sm w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex-shrink-0 flex items-center">
                PDF Manager
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {isLoggedIn && (
                  <>
                    <Link href="/upload" className="...">Upload</Link>
                    <Link href="/documents" className="...">Documents</Link>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center">
              {isLoggedIn ? (
                <button onClick={handleLogout} className="...">Logout</button>
              ) : (
                <>
                  <Link href="/login" className="...">Login</Link>
                  <Link href="/register" className="ml-4 ...">Register</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-grow w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default Layout;