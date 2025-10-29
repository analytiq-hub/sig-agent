'use client'

import React, { useEffect, useState, useMemo } from 'react';
import { SigAgentAccountApi } from '@/utils/api';
import { UsageData } from '@/types/index';

interface SubscriptionCreditsProps {
  organizationId: string;
  currentPlan?: string | null;
  subscriptionStatus?: string | null;
  refreshKey?: number; // Add refresh key to trigger data refetch
}

const SubscriptionCredits: React.FC<SubscriptionCreditsProps> = ({ 
  organizationId, 
  currentPlan, 
  subscriptionStatus,
  refreshKey
}) => {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const sigAgentAccountApi = useMemo(() => new SigAgentAccountApi(), []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const usageResponse = await sigAgentAccountApi.getCurrentUsage(organizationId);
        
        if (usageResponse.data) {
          setUsageData(usageResponse.data);
        }
      } catch (error) {
        console.error('Error fetching credits data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, refreshKey, sigAgentAccountApi]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!usageData) return null;

  const totalCreditsRemaining = usageData.purchased_credits_remaining + usageData.granted_credits_remaining;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">SPU Credits</h3>
            <div className="text-xl font-bold text-gray-800">
              {totalCreditsRemaining.toLocaleString()} remaining
            </div>
            <div className="text-xs text-gray-500">
              {usageData.purchased_credits_remaining} purchased + {usageData.granted_credits_remaining} granted
            </div>
          </div>
          <div className="text-right">
            {currentPlan && (
              <>
                <div className="text-sm font-medium text-gray-900">Plan: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</div>
                {subscriptionStatus && (
                  <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                    subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' :
                    subscriptionStatus === 'cancelling' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {subscriptionStatus}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCredits;