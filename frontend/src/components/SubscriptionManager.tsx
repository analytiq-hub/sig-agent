'use client'

import React, { useEffect, useState } from 'react';
import { getCustomerPortalApi } from '@/utils/api';
import SubscriptionPlans from './SubscriptionPlans';
import SubscriptionUsage from './SubscriptionUsage';
import SubscriptionAdminCredit from './SubscriptionAdminCredit';
import SubscriptionCreditsWidget from './SubscriptionCreditsWidget';
import BarChartIcon from '@mui/icons-material/BarChart';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { toast } from 'react-toastify';

interface SubscriptionProps {
  organizationId: string;
}

const SubscriptionManager: React.FC<SubscriptionProps> = ({ organizationId }) => {
  const [customerPortalUrl, setCustomerPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<number | null>(null);
  const [stripePaymentsPortal, setStripePaymentsPortal] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [view, setView] = useState<'usage' | 'pricing'>('pricing');
  const [usageRefreshKey, setUsageRefreshKey] = useState<number>(0); // Add this state

  useEffect(() => {
    const fetchPortalUrl = async () => {
      try {
        setLoading(true);
        const response = await getCustomerPortalApi(organizationId);
        setCustomerPortalUrl(response.url);
      } catch (error) {
        console.info('Could not fetch customer portal URL:', error);
        // Optionally show a message if this is due to Stripe being disabled
        if (error instanceof Error && error.message.includes('Not Found')) {
          console.info('Customer portal unavailable - Stripe may be disabled');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPortalUrl();
  }, [organizationId]);

  useEffect(() => {
    // Check for success/cancel parameters in URL
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    
    if (success === 'true') {
      toast.success('Subscription activated successfully!');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (canceled === 'true') {
      toast.info('Subscription setup was canceled.');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handlePaymentMethodStatusChange = (hasPaymentMethod: boolean) => {
    setHasPaymentMethod(hasPaymentMethod);
  };

  const handleSubscriptionStatusChange = (subscriptionStatus: string | null) => {
    setSubscriptionStatus(subscriptionStatus);
  };

  const handleCancellationInfoChange = (cancelAtPeriodEnd: boolean, currentPeriodEnd: number | null) => {
    setCurrentPeriodEnd(currentPeriodEnd);
  };

  const handleStripePaymentsPortalChange = (stripePaymentsPortal: boolean) => {
    setStripePaymentsPortal(stripePaymentsPortal);
  };

  const handleCurrentPlanChange = (currentPlan: string | null) => {
    setCurrentPlan(currentPlan);
  };



  const handleCancelSubscription = async () => {
    if (!organizationId) return;
    const confirmed = confirm(
      'Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period.'
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      await import('@/utils/api').then(api => api.cancelSubscriptionApi(organizationId));
      setSubscriptionStatus('cancelling');
    } catch (e) {
      console.error('Error cancelling subscription:', e);
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
      {/* Top bar: Title + Toggle Links */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">
          {view === 'usage' ? 'Usage' : 'Billing'}
        </h2>
        <div className="flex gap-2">
          {view === 'usage' ? (
            <button
              className="flex items-center px-3 py-1 rounded-md font-medium text-blue-700 hover:text-gray-800 transition-colors"
              onClick={() => setView('pricing')}
            >
              <CreditCardIcon className="mr-1 mb-[4px]" fontSize="small" />
              See Pricing
            </button>
          ) : (
            <button
              className="flex items-center px-3 py-1 rounded-md font-medium text-blue-700 hover:text-gray-800 transition-colors"
              onClick={() => setView('usage')}
            >
              <BarChartIcon className="mr-1 mb-[4px]" fontSize="small" />
              View Usage
            </button>
          )}
        </div>
      </div>

      {/* Conditionally Render Views */}
      {view === 'usage' ? (
        <>
          <SubscriptionUsage 
            organizationId={organizationId} 
            key={usageRefreshKey} // Add this key to force re-render
          />
          <div className="mt-6">
            <SubscriptionAdminCredit 
              organizationId={organizationId}
              onCreditsAdded={() => {
                // Refresh usage data by updating the key
                setUsageRefreshKey(prev => prev + 1);
              }}
            />
          </div>
        </>
      ) : (
        <>
          {/* Top Section: Credits Widget and Quick Actions */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Credits Widget */}
            <div className="lg:col-span-2">
              <SubscriptionCreditsWidget 
                organizationId={organizationId}
                currentPlan={currentPlan}
                subscriptionStatus={subscriptionStatus}
              />
            </div>
            
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {stripePaymentsPortal && (
                  <a 
                    href={customerPortalUrl || undefined} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center w-full px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    {currentPlan === 'enterprise' ? 'Previous Plan Billing' : 'Manage Billing'}
                  </a>
                )}
                <button
                  className="flex items-center w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  onClick={() => setView('usage')}
                >
                  <BarChartIcon className="mr-2" fontSize="small" />
                  View Detailed Usage
                </button>
              </div>
            </div>
          </div>

          {/* Subscription Plans */}
          <SubscriptionPlans 
            organizationId={organizationId}
            onPaymentMethodStatusChange={handlePaymentMethodStatusChange}
            onSubscriptionStatusChange={handleSubscriptionStatusChange}
            onCancellationInfoChange={handleCancellationInfoChange}
            onStripePaymentsPortalChange={handleStripePaymentsPortalChange}
            onCurrentPlanChange={handleCurrentPlanChange}
            onCancelSubscription={handleCancelSubscription}
            cancelAtPeriodEnd={subscriptionStatus === 'cancelling'}
            currentPeriodEnd={currentPeriodEnd}
          />

          {/* Special status messages */}
          {subscriptionStatus === 'canceled' && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md text-center">
              <p className="text-sm text-gray-600">
                Your subscription has been cancelled. You can reactivate it by selecting a plan above.
              </p>
            </div>
          )}
          {subscriptionStatus === 'past_due' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-center">
              <p className="text-sm text-yellow-700">
                Your payment is past due. Please update your payment method to continue service.
              </p>
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
          </div>
        </>
      )}
    </div>
  );
};

export default SubscriptionManager; 