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
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<number | null>(null);

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

  const handleSubscriptionStatusChange = (subscriptionStatus: string | null) => {
    setSubscriptionStatus(subscriptionStatus);
  };

  const handleCancellationInfoChange = (cancelAtPeriodEnd: boolean, currentPeriodEnd: number | null) => {
    setCurrentPeriodEnd(currentPeriodEnd);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getSubscriptionStatusBadge = (status: string | null) => {
    if (!status) return null;
    const statusConfig = {
      'active': { color: 'bg-green-100 text-green-800', text: 'Active' },
      'cancelling': { color: 'bg-orange-100 text-orange-800', text: 'Cancelling' },
      'canceled': { color: 'bg-red-100 text-red-800', text: 'Cancelled' },
      'past_due': { color: 'bg-yellow-100 text-yellow-800', text: 'Past Due' },
      'unpaid': { color: 'bg-red-100 text-red-800', text: 'Unpaid' },
      'incomplete': { color: 'bg-blue-100 text-blue-800', text: 'Incomplete' },
      'incomplete_expired': { color: 'bg-gray-100 text-gray-800', text: 'Expired' },
      'trialing': { color: 'bg-purple-100 text-purple-800', text: 'Trial' },
      'no_subscription': { color: 'bg-gray-100 text-gray-800', text: 'No Subscription' }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['no_subscription'];
    return (
      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </div>
    );
  };

  const handleCancelSubscription = async () => {
    if (!organizationId) return;
    const confirmed = window.confirm(
      'Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period.'
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      await import('@/utils/api').then(api => api.cancelSubscriptionApi(organizationId));
      setSubscriptionStatus('cancelling');
    } catch (e) {
      // handle error, e.g. toast
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      await import('@/utils/api').then(api => api.reactivateSubscriptionApi(organizationId));
      setSubscriptionStatus('active');
    } catch (e) {
      // handle error, e.g. toast
    } finally {
      setLoading(false);
    }
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
              onSubscriptionStatusChange={handleSubscriptionStatusChange}
              onCancellationInfoChange={handleCancellationInfoChange}
            />
          </div>
          {subscriptionStatus && (
            <div className="flex flex-col items-center gap-2 mt-4">
              <div className="inline-flex items-center gap-2">
                <span className="text-sm text-gray-600">Subscription Status:</span>
                {getSubscriptionStatusBadge(subscriptionStatus)}
              </div>
              {subscriptionStatus === 'cancelling' && currentPeriodEnd && (
                <p className="text-sm text-orange-600">
                  Your subscription will be cancelled on {formatDate(currentPeriodEnd)}. You can reactivate it anytime before then.
                </p>
              )}
              {subscriptionStatus === 'canceled' && (
                <p className="text-sm text-gray-500">
                  Your subscription has been cancelled. You can reactivate it by selecting a plan below.
                </p>
              )}
              {subscriptionStatus === 'past_due' && (
                <p className="text-sm text-yellow-600">
                  Your payment is past due. Please update your payment method to continue service.
                </p>
              )}
              <div className="flex flex-row gap-2 mt-2">
                {subscriptionStatus === 'active' && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-1"></div>
                    ) : (
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    Cancel Subscription
                  </button>
                )}
                {subscriptionStatus === 'cancelling' && (
                  <button
                    onClick={handleReactivateSubscription}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                    ) : (
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    Reactivate Now
                  </button>
                )}
                <a 
                  href={customerPortalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
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
            </div>
          )}
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