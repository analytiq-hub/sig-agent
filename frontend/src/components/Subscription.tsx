'use client'

import React, { useEffect, useState } from 'react';
import { getCustomerPortalApi } from '@/utils/api';
import SubscriptionPlans from './SubscriptionPlans';

interface SubscriptionProps {
  organizationId: string;
}

const Subscription: React.FC<SubscriptionProps> = ({ organizationId }) => {
  const [customerPortalUrl, setCustomerPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchPortalUrl = async () => {
      try {
        setLoading(true);
        const response = await getCustomerPortalApi(organizationId);
        setCustomerPortalUrl(response.url);
      } catch (error) {
        console.info('Could not fetch customer portal URL:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortalUrl();
  }, [organizationId]);

  const handlePaymentMethodStatusChange = (hasPaymentMethod: boolean) => {
    setHasPaymentMethod(hasPaymentMethod);
  };

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
            <SubscriptionPlans 
              organizationId={organizationId} 
              onPaymentMethodStatusChange={handlePaymentMethodStatusChange}
            />
          </div>
          <div className="flex flex-col items-center justify-center gap-2 text-sm text-gray-600">
            {hasPaymentMethod === false && (
              <div className="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md w-full max-w-md">
                <p className="text-yellow-800 text-sm flex items-center">
                  <svg className="h-4 w-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  No payment method configured. Please set up a payment method to manage your subscription.
                </p>
              </div>
            )}
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