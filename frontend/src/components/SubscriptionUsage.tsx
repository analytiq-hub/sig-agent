'use client'

import React, { useEffect, useState } from 'react';
import { getCurrentUsageApi } from '@/utils/api';

interface SubscriptionUsageProps {
  organizationId: string;
}

interface UsageData {
  total_usage: number;
  metered_usage: number;
  remaining_included: number;
  subscription_type: string;
  usage_unit?: string; // New field to indicate usage unit
  period_start?: number; // New field for billing period start
  period_end?: number; // New field for billing period end
}

const SubscriptionUsage: React.FC<SubscriptionUsageProps> = ({ organizationId }) => {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

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

  const usageUnit = usageData.usage_unit || 'pages'; // Default to pages for backward compatibility
  const usageUnitDisplay = usageUnit === 'spu' ? 'SPUs' : 'pages';

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Current Usage</h3>
      
      {/* Compact Grid */}
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

      {/* Usage Bar and Details */}
      <div className="space-y-4">
        {/* Usage Display */}
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{usageData.total_usage} {usageUnitDisplay} used</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="h-2 rounded-full transition-all duration-300 bg-blue-500"
              style={{ width: '100%' }}
            ></div>
          </div>
        </div>

        {/* SPU Information */}
        {usageUnit === 'spu' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-800 text-sm">
              💡 SPU (Service Processing Unit) is our flexible billing unit. Currently, 1 page = 1 SPU. 
              Different LLM models may consume different SPU amounts per page in the future.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionUsage; 