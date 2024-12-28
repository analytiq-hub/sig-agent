'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SettingsLayout from '@/components/SettingsLayout';
import { getUserApi, updateUserApi, UserResponse } from '@/utils/api';

const UserEditPage = ({ params }: { params: { userId: string } }) => {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getUserApi(params.userId);
        setUser(userData);
        setName(userData.name || '');
        setIsAdmin(userData.isAdmin);
      } catch (error) {
        setError('Failed to load user');
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [params.userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateUserApi(params.userId, {
        name,
        isAdmin,
      });
      router.push('/settings/admin/users');
    } catch (error) {
      setError('Failed to update user');
      console.error('Error updating user:', error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <SettingsLayout selectedMenu="system_users">
      <div className="max-w-lg mx-auto">
        <h2 className="text-xl font-semibold mb-6">Edit User</h2>
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
          {/* Email Display */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <span className="text-sm text-gray-900">{user.email}</span>
          </div>

          {/* Name Input */}
          <div className="flex items-center justify-between">
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-56 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Admin Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Administrator</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.push('/settings/admin/users')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </SettingsLayout>
  );
};

export default UserEditPage; 