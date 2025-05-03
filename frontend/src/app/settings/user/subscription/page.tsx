'use client'

import React, { useEffect, useState } from 'react';
import SettingsLayout from '@/components/SettingsLayout';
import { useAppSession } from '@/utils/useAppSession';
import { getCustomerPortalApi } from '@/utils/api';
import { toast } from 'react-toastify';

const SubscriptionPage: React.FC = () => {
  const { session, status } = useAppSession();
  const [customerPortalUrl, setCustomerPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPortalUrl = async () => {
      if (session?.user?.id) {
        try {
          setLoading(true);
          const response = await getCustomerPortalApi(session.user.id);
          setCustomerPortalUrl(response.url);
        } catch (error) {
          console.info('Could not fetch customer portal URL:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchPortalUrl();
  }, [session?.user?.id]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <SettingsLayout selectedMenu="user_subscription">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your subscription and billing information
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          ) : customerPortalUrl ? (
            <div className="space-y-4">
              <p className="text-gray-700">
                Use the Stripe customer portal to manage your subscription, view invoices, 
                update payment methods, and more.
              </p>
              <a 
                href={customerPortalUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Manage Subscription
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-700">
                You don&apos;t have an active subscription. Subscribe to access premium features.
              </p>
              <button
                onClick={async () => {
                  if (session?.user?.id) {
                    try {
                      setLoading(true);
                      const response = await getCustomerPortalApi(session.user.id);
                      window.open(response.url, '_blank');
                    } catch (error: unknown) {
                      // If the error, stringified, is Not Found, show a different message
                      let errorMsg = '';
                      if (error instanceof Error) {
                        errorMsg = error.message;
                      } else {
                        errorMsg = String(error);
                      }
                      if (errorMsg.startsWith('Not Found')) {
                        toast.error('Subscription not implemented.');
                      } else {
                        toast.error(`Failed to access subscription portal: ${errorMsg}`);
                      }
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Subscribe Now
              </button>
            </div>
          )}
        </div>
      </div>
    </SettingsLayout>
  );
};

export default SubscriptionPage;