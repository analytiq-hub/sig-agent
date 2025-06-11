'use client'

import React, { useEffect, useState } from 'react';
import { getCustomerPortalApi } from '@/utils/api';
import SubscriptionPlans from './SubscriptionPlans';

interface SubscriptionProps {
  userId: string;
}

const Subscription: React.FC<SubscriptionProps> = ({ userId }) => {
  const [customerPortalUrl, setCustomerPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPortalUrl = async () => {
      try {
        setLoading(true);
        const response = await getCustomerPortalApi(userId);
        setCustomerPortalUrl(response.url);
      } catch (error) {
        console.info('Could not fetch customer portal URL:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortalUrl();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      {customerPortalUrl ? (
        <div className="space-y-4">
          <div>
            <SubscriptionPlans userId={userId} />
          </div>
          <div className="flex flex-col items-center justify-center gap-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <a 
                href={customerPortalUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg 
                  className="h-4 w-4 text-white -mt-1" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" 
                  />
                </svg>
                <span className="flex items-center">Manage Payment</span>
              </a>
            </div>
            <p className="text-gray-500 text-xs">
              View and download past invoices, update payment methods, and manage your billing preferences
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <p className="text-gray-700">
            Stripe is not configured.
          </p>
        </div>
      )}
    </div>
  );
};

export default Subscription; 