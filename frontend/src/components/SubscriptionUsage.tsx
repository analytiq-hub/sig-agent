'use client'

import React, { useEffect, useState } from 'react';
import { getCurrentUsageApi } from '@/utils/api';
import SubscriptionCredits from './SubscriptionCredit';

interface SubscriptionUsageProps {
  organizationId: string;
}

interface UsageData {
  total_usage: number;
  metered_usage: number;
  remaining_included: number;
  subscription_type: string;
  usage_unit?: string;
  period_start?: number;
  period_end?: number;
  // New credit fields
  credits_total: number;
  credits_used: number;
  credits_remaining: number;
  paid_usage: number;
}

const SubscriptionUsage: React.FC<SubscriptionUsageProps> = ({ organizationId }) => {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoading(true);
        const response = await getCurrentUsageApi(organizationId);
        if (response.data) {
          setUsageData(response.data);
        }
      } catch (error) {
        console.error('Error fetching usage:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [organizationId]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Current Usage</h3>
      
      {/* Credits Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-md font-medium text-gray-700">SPU Credits</h4>
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Purchase Credits
          </button>
        </div>
        
        {/* Credits Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{usageData.credits_used} of {usageData.credits_total} credits used</span>
            <span>{Math.round((usageData.credits_used / usageData.credits_total) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="h-2 rounded-full transition-all duration-300 bg-green-500"
              style={{ width: `${Math.min((usageData.credits_used / usageData.credits_total) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Paid Usage Section */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-700 mb-3">Paid Usage</h4>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
          <div className="text-gray-600 font-medium">Paid SPUs</div>
          <div className="text-2xl font-bold text-gray-700">{usageData.paid_usage} {usageUnitDisplay}</div>
        </div>
      </div>

      {/* Compact Grid - Original Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-md px-4 py-2 mb-4">
        <div>
          <div className="text-gray-500">Plan</div>
          <div className="font-medium capitalize">{usageData.subscription_type}</div>
        </div>
        <div>
          <div className="text-gray-500">Total Usage</div>
          <div className="font-medium">{usageData.total_usage} {usageUnitDisplay}</div>
        </div>
        <div>
          <div className="text-gray-500">Billing Period</div>
          {usageData.period_start && usageData.period_end && (
            <div className="font-medium">{formatDate(usageData.period_start)} - {formatDate(usageData.period_end)}</div>
          )}
        </div>
      </div>

      {/* Credit Purchase Modal */}
      {showPurchaseModal && (
        <SubscriptionCredits
          organizationId={organizationId}
          currentCredits={usageData?.credits_remaining || 0}
          onClose={() => setShowPurchaseModal(false)}
        />
      )}
    </div>
  );
};

export default SubscriptionUsage; 