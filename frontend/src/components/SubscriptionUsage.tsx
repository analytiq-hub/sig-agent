'use client'

import React, { useEffect, useState } from 'react';
import { getCurrentUsageApi } from '@/utils/api';

interface SubscriptionUsageProps {
  organizationId: string;
}

interface UsageData {
  total_usage: number;
  included_usage: number;
  overage_usage: number;
  remaining_included: number;
  subscription_type: string;
  usage_unit?: string; // New field to indicate usage unit
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

        {/* Usage Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Plan:</span>
            <span className="ml-2 font-medium capitalize">{usageData.subscription_type}</span>
          </div>
          <div>
            <span className="text-gray-600">Total Usage:</span>
            <span className="ml-2 font-medium">{usageData.total_usage} {usageUnitDisplay}</span>
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