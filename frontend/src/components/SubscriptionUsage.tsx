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

  const usagePercentage = (usageData.total_usage / usageData.included_usage) * 100;
  const isOverLimit = usageData.total_usage > usageData.included_usage;
  const usageUnit = usageData.usage_unit || 'pages'; // Default to pages for backward compatibility
  const usageUnitDisplay = usageUnit === 'spu' ? 'SPUs' : 'pages';

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Current Usage</h3>
      
      <div className="space-y-4">
        {/* Usage Progress Bar */}
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{usageData.total_usage} / {usageData.included_usage} {usageUnitDisplay} used</span>
            <span>{Math.round(usagePercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                isOverLimit ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
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
            <span className="text-gray-600">Included:</span>
            <span className="ml-2 font-medium">{usageData.included_usage} {usageUnitDisplay}</span>
          </div>
          <div>
            <span className="text-gray-600">Remaining:</span>
            <span className={`ml-2 font-medium ${usageData.remaining_included <= 10 ? 'text-red-600' : 'text-green-600'}`}>
              {usageData.remaining_included} {usageUnitDisplay}
            </span>
          </div>
          {usageData.overage_usage > 0 && (
            <div>
              <span className="text-gray-600">Overage:</span>
              <span className="ml-2 font-medium text-red-600">{usageData.overage_usage} {usageUnitDisplay}</span>
            </div>
          )}
        </div>

        {/* Warnings */}
        {usageData.remaining_included <= 10 && usageData.remaining_included > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-sm">
              ⚠️ You&apos;re running low on included {usageUnitDisplay}. Consider upgrading your plan.
            </p>
          </div>
        )}

        {isOverLimit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">
              ⚠️ You&apos;ve exceeded your included usage. Additional {usageUnitDisplay} will be charged at the overage rate.
            </p>
          </div>
        )}

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