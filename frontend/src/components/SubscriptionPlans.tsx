'use client'

import React, { useEffect, useState } from 'react';
import { getCustomerPortalApi, getSubscriptionPlansApi, changeSubscriptionPlanApi } from '@/utils/api';
import { toast } from 'react-toastify';
import type { SubscriptionPlan } from '@/types/payments';

interface SubscriptionPlansProps {
  organizationId: string;
}

const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ organizationId }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const data = await getSubscriptionPlansApi(organizationId);
        setPlans(data.plans);
        setCurrentPlan(data.current_plan);
        setSelectedPlan(data.current_plan || 'basic');
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
        toast.error('Failed to load subscription plans');
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [organizationId]);

  const handlePlanChange = async (planId: string) => {
    try {
      setLoading(true);
      setSelectedPlan(planId);
      await changeSubscriptionPlanApi(organizationId, planId);

      // const portalResponse = await getCustomerPortalApi(organizationId);
      // window.location.href = portalResponse.url;
    } catch (error) {
      console.error('Error changing plan:', error);
      toast.error('Failed to change subscription plan');
      setSelectedPlan(currentPlan || 'basic');
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {plans.map((plan) => (
        <div
          key={plan.plan_id}
          className={`bg-white rounded-lg shadow-lg p-6 flex flex-col ${
            selectedPlan === plan.plan_id ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          <div className="flex-grow">
            <h3 className="text-xl font-bold mb-4">{plan.name}</h3>
            <div className="text-3xl font-bold mb-4">
              ${plan.price}
              <span className="text-sm font-normal text-gray-500">
                /{plan.interval}
              </span>
            </div>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center">
                <svg
                  className="h-5 w-5 text-green-500 mr-2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7"></path>
                </svg>
                {plan.included_usage} pages included
              </li>
              <li className="flex items-center">
                <svg
                  className="h-5 w-5 text-green-500 mr-2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7"></path>
                </svg>
                ${plan.overage_price} per page after limit
              </li>
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <svg
                    className="h-5 w-5 text-green-500 mr-2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => handlePlanChange(plan.plan_id)}
            disabled={currentPlan === plan.plan_id}
            className={`w-full py-2 px-4 rounded-md ${
              currentPlan === plan.plan_id
                ? 'bg-gray-300 cursor-not-allowed'
                : selectedPlan === plan.plan_id
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {currentPlan === plan.plan_id 
              ? 'Current Plan' 
              : selectedPlan === plan.plan_id 
              ? 'Selected Plan' 
              : 'Select Plan'}
          </button>
        </div>
      ))}
    </div>
  );
};

export default SubscriptionPlans; 