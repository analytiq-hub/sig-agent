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
            {/* <h2 className="text-lg font-semibold mb-4">Available Plans</h2> */}
            <SubscriptionPlans userId={userId} />
          </div>
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