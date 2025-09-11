'use client'

import React, { useEffect, useState } from 'react';
import { getCreditConfigApi, purchaseCreditsApi, addCreditsApi } from '@/utils/api';
import { toast } from 'react-toastify';
import { useAppSession } from '@/utils/useAppSession';
import { isSysAdmin } from '@/utils/roles';
import { CreditConfig } from '@/types/index';

interface SubscriptionPurchaseProps {
  organizationId: string;
  currentPlan?: string | null;
  subscriptionStatus?: string | null;
  refreshKey?: number;
  onCreditsUpdated?: () => void; // Callback when credits are updated
  disabled?: boolean; // Whether purchase functionality is disabled
}

const SubscriptionPurchase: React.FC<SubscriptionPurchaseProps> = ({ 
  organizationId, 
  currentPlan, 
  subscriptionStatus,
  refreshKey,
  onCreditsUpdated,
  disabled = false
}) => {
  const { session } = useAppSession();
  const [creditConfig, setCreditConfig] = useState<CreditConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseAmount, setPurchaseAmount] = useState<number>(500);
  const [adminAmount, setAdminAmount] = useState<number>(100);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  const isAdmin = isSysAdmin(session);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const configResponse = await getCreditConfigApi(organizationId);
        setCreditConfig(configResponse);
      } catch (error) {
        console.error('Error fetching credits data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, refreshKey]);

  const canPurchaseCredits = () => {
    if (!currentPlan) return true; // No subscription, can purchase
    const allowedPlans = ['individual', 'team'];
    return allowedPlans.includes(currentPlan) || 
           ['no_subscription', 'canceled', 'incomplete_expired'].includes(subscriptionStatus || '');
  };

  const handlePurchaseCredits = async () => {
    if (!creditConfig) return;
    
    const totalCost = purchaseAmount * creditConfig.price_per_credit;
    
    if (totalCost < creditConfig.min_cost || totalCost > creditConfig.max_cost) {
      toast.error(`Purchase amount must be between $${creditConfig.min_cost} and $${creditConfig.max_cost}`);
      return;
    }

    setPurchaseLoading(true);
    try {
      const currentUrl = window.location.href;
      const response = await purchaseCreditsApi(organizationId, { 
        credits: purchaseAmount,
        success_url: currentUrl, 
        cancel_url: currentUrl 
      });
      
      if (response.checkout_url) {
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

  const handleAddAdminCredits = async () => {
    if (adminAmount <= 0) {
      toast.error('Please enter a positive amount');
      return;
    }

    setAdminLoading(true);
    try {
      await addCreditsApi(organizationId, adminAmount);
      toast.success(`Added ${adminAmount} credits successfully!`);
      setAdminAmount(100); // Reset to default
      // Trigger refresh of credits display
      if (onCreditsUpdated) {
        onCreditsUpdated();
      }
    } catch (error) {
      console.error('Error adding credits:', error);
      toast.error(`Failed to add credits: ${error}`);
    } finally {
      setAdminLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-3">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-3 space-y-3">
        {/* Admin Section */}
        {isAdmin && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-yellow-800">
                <svg className="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Grant Credits
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={adminAmount}
                onChange={(e) => setAdminAmount(parseInt(e.target.value) || 0)}
                min="1"
                className="flex-1 px-2 py-1 text-sm border border-yellow-300 rounded focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                placeholder="Amount"
              />
              <button
                onClick={handleAddAdminCredits}
                disabled={adminLoading || adminAmount <= 0}
                className="px-3 py-1 text-sm bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-300 text-white rounded font-medium disabled:cursor-not-allowed"
              >
                {adminLoading ? 'Adding...' : 'Grant'}
              </button>
            </div>
          </div>
        )}

        {/* Purchase Section */}
        {canPurchaseCredits() && creditConfig && !isAdmin && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-blue-900">Purchase Credits</h4>
              <span className="text-xs text-blue-600">${creditConfig.price_per_credit} each</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="number"
                value={purchaseAmount || ''}
                onChange={e => {
                  const value = e.target.value;
                  setPurchaseAmount(value === '' ? 0 : parseInt(value) || 0);
                }}
                className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Amount"
                disabled={purchaseLoading || disabled}
              />
              <button
                onClick={handlePurchaseCredits}
                disabled={
                  disabled ||
                  purchaseLoading || 
                  !purchaseAmount || 
                  purchaseAmount <= 0 || 
                  (purchaseAmount * creditConfig.price_per_credit) < creditConfig.min_cost || 
                  (purchaseAmount * creditConfig.price_per_credit) > creditConfig.max_cost
                }
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded font-medium disabled:cursor-not-allowed"
              >
                {purchaseLoading ? 'Processing...' : 'Buy'}
              </button>
            </div>
            <div className="text-xs text-blue-600">
              Total: ${purchaseAmount > 0 ? (purchaseAmount * creditConfig.price_per_credit).toFixed(2) : '0.00'}
            </div>
            {disabled && (
              <div className="text-xs text-gray-500 mt-1">
                Credit purchasing is currently disabled. Contact your administrator for additional credits.
              </div>
            )}
          </div>
        )}

        {currentPlan === 'enterprise' && !isAdmin && (
          <div className="text-center text-sm text-gray-500">
            Enterprise plans have unlimited usage
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPurchase;
