'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvitationApi, getInvitationApi } from '@/utils/api';
import { toast } from 'react-hot-toast';
import { signIn } from 'next-auth/react';

interface UserAcceptInvitationProps {
  token: string;
}

const UserAcceptInvitation: React.FC<UserAcceptInvitationProps> = ({ token }) => {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: ''
  });
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const invitation = await getInvitationApi(token);
        setInvitationEmail(invitation.email);
      } catch (error) {
        console.error('Error fetching invitation:', error);
        toast.error('Invalid or expired invitation');
        router.push('/auth/signin');
      }
    };

    fetchInvitation();
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!invitationEmail) {
      setError('Invalid invitation');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsSubmitting(true);
    try {
      await acceptInvitationApi(token, {
        name: formData.name,
        password: formData.password
      });

      toast.success('Account created successfully');
      
      const result = await signIn('credentials', {
        email: invitationEmail,
        password: formData.password,
        redirect: false
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      router.push('/dashboard');
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setError(error instanceof Error ? error.message : 'Failed to accept invitation');
      toast.error('Failed to accept invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!invitationEmail) {
    return (
      <div className="text-center">
        Loading invitation...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Accept Invitation
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
            Create your account
            </p>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
                    {error}
                    </div>
                )}

                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name
                    </label>
                    <div className="mt-1">
                    <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    </div>
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                    </label>
                    <div className="mt-1">
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    </div>
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirm Password
                    </label>
                    <div className="mt-1">
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    </div>
                </div>

                <div>
                    <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                    {isSubmitting ? 'Creating Account...' : 'Create Account'}
                    </button>
                </div>
                </form>
            </div>
        </div>
    </div>
  );
};

export default UserAcceptInvitation; 