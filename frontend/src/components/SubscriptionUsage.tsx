'use client'

import React, { useEffect, useState } from 'react';
import { getCurrentUsageApi, getSubscriptionApi, getCreditConfigApi, purchaseCreditsApi } from '@/utils/api';
import { toast } from 'react-toastify';
import { CreditConfig, UsageData } from '@/types/index';

interface SubscriptionUsageProps {
  organizationId: string;
}

interface SubscriptionData {
  subscription_status: string | null;
  current_plan: string | null;
}

const SubscriptionUsage: React.FC<SubscriptionUsageProps> = ({ organizationId }) => {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creditConfig, setCreditConfig] = useState<CreditConfig | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState<number>(500);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usageResponse, subscriptionResponse, configResponse] = await Promise.all([
          getCurrentUsageApi(organizationId),
          getSubscriptionApi(organizationId),
          getCreditConfigApi(organizationId)
        ]);
        
        if (usageResponse.data) {
          setUsageData(usageResponse.data);
        }
        
        setSubscriptionData({
          subscription_status: subscriptionResponse.subscription_status,
          current_plan: subscriptionResponse.current_plan
        });

        setCreditConfig(configResponse);
        setPurchaseAmount(500);
      } catch (error) {
        console.error('Error fetching usage and subscription data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Check if user can purchase credits (only if not subscribed)
  const canPurchaseCredits = () => {
    if (!subscriptionData) return false;
    
    // Allow purchase if no subscription or subscription is cancelled/expired
    const allowedStatuses = ['no_subscription', 'canceled', 'incomplete_expired'];
    return !subscriptionData.current_plan || allowedStatuses.includes(subscriptionData.subscription_status || '');
  };

  const handlePurchaseCredits = async () => {
    if (!creditConfig) return;
    
    // Calculate cost for the requested amount
    const totalCost = purchaseAmount * creditConfig.price_per_credit;
    
    if (totalCost < creditConfig.min_cost || totalCost > creditConfig.max_cost) {
      toast.error(`Purchase amount must be between $${creditConfig.min_cost} and $${creditConfig.max_cost}`);
      return;
    }

    setPurchaseLoading(true);
    try {
      console.log('Starting credit purchase for:', purchaseAmount, 'credits');
      
      const currentUrl = window.location.href;
      const response = await purchaseCreditsApi(organizationId, { 
        credits: purchaseAmount,
        success_url: currentUrl, 
        cancel_url: currentUrl 
      });
      
      console.log('Purchase response:', response);
      
      if (response.checkout_url) {
        console.log('Redirecting to:', response.checkout_url);
        window.location.href = response.checkout_url;
      } else {
        toast.error('Failed to start checkout - no URL received');
      }
    } catch (err: unknown) {
      console.error('Purchase error:', err);
      let message = 'Failed to start checkout.';
      if (err instanceof Error) message = err.message;
      toast.error(message);
    } finally {
      setPurchaseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-20">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className="text-gray-500 text-sm">
        No usage data available
      </div>
    );
  }

  const usageUnit = usageData.usage_unit || 'pages';
  const usageUnitDisplay = usageUnit === 'spu' ? 'SPUs' : 'pages';

  // Calculate total credits for display
  const totalCreditsRemaining = usageData.purchased_credits_remaining + usageData.admin_credits_remaining;

  return (
    <div className="bg-white p-6 rounded-lg shadow">      
      {/* Credits Section */}
      <div className="mb-6">

        {/* Total Credits Summary */}
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <div className="text-sm font-medium text-gray-700 mb-1">Total SPU Credits</div>
          <div className="text-lg font-bold text-gray-800">
            {totalCreditsRemaining} credits remaining
          </div>
          <div className="text-xs text-gray-500">
            {usageData.purchased_credits_remaining} purchased + {usageData.admin_credits_remaining} admin
          </div>
        </div>

        {/* Inline Purchase Credits Section */}
        {canPurchaseCredits() && creditConfig && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h5 className="text-sm font-medium text-blue-900 mb-3">Purchase Additional Credits</h5>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label htmlFor="credit-amount" className="block text-xs font-medium text-blue-700 mb-1">
                    Amount to Purchase
                  </label>
                  <input
                    type="number"
                    id="credit-amount"
                    value={purchaseAmount || ''}
                    onChange={e => {
                      const value = e.target.value;
                      if (value === '') {
                        setPurchaseAmount(0);
                      } else {
                        const numValue = parseInt(value);
                        setPurchaseAmount(isNaN(numValue) ? 0 : numValue);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter number of credits"
                    disabled={purchaseLoading}
                  />
                </div>
                <div className="text-xs text-blue-600">
                  <div>Price per credit:</div>
                  <div className="font-medium">{creditConfig.price_per_credit} {creditConfig.currency.toUpperCase()}</div>
                </div>
                <div className="text-xs text-blue-600">
                  <div>Total:</div>
                  <div className="font-bold text-blue-800">
                    {purchaseAmount > 0 ? (purchaseAmount * creditConfig.price_per_credit).toFixed(2) : '0.00'} {creditConfig.currency.toUpperCase()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePurchaseCredits}
                  disabled={
                    purchaseLoading || 
                    !purchaseAmount || 
                    purchaseAmount <= 0 || 
                    (purchaseAmount * creditConfig.price_per_credit) < creditConfig.min_cost || 
                    (purchaseAmount * creditConfig.price_per_credit) > creditConfig.max_cost
                  }
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  {purchaseLoading ? 'Processing...' : 'Purchase'}
                </button>
              </div>
              <div className="text-xs text-blue-600">
                Credits are used after subscription usage. You currently have <span className="font-semibold">{totalCreditsRemaining}</span> credits remaining.
                <br />
                Purchase amount must be between ${creditConfig.min_cost} and ${creditConfig.max_cost}.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compact Grid - Original Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-md px-4 py-2 mb-4">
        <div>
          <div className="text-gray-500">Plan</div>
          <div className="font-medium capitalize">
            {usageData.subscription_type || <span className="text-gray-400">No Active Subscription</span>}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Metered SPUs</div>
          <div className="font-medium">{usageData.metered_usage} {usageUnitDisplay}</div>
        </div>
        <div>
          <div className="text-gray-500">Billing Period</div>
          {usageData.period_start && usageData.period_end ? (
            <div className="font-medium">{formatDate(usageData.period_start)} - {formatDate(usageData.period_end)}</div>
          ) : (
            <div className="font-medium text-gray-400">No Active Subscription</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionUsage; 