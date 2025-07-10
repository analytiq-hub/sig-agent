'use client'

import React, { useEffect, useState } from 'react';
import { getCustomerPortalApi, getSubscriptionApi, updateOrganizationApi, activateSubscriptionApi, getOrganizationApi } from '@/utils/api';
import { toast } from 'react-toastify';
import type { SubscriptionPlan } from '@/types/payments';
import type { Organization } from '@/types/organizations';
import { useOrganization } from '@/contexts/OrganizationContext';

interface SubscriptionPlansProps {
  organizationId: string;
  onPaymentMethodStatusChange?: (hasPaymentMethod: boolean) => void;
  onSubscriptionStatusChange?: (subscriptionStatus: string | null) => void;
  onCancellationInfoChange?: (cancelAtPeriodEnd: boolean, currentPeriodEnd: number | null) => void;
}

const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ 
  organizationId, 
  onPaymentMethodStatusChange,
  onSubscriptionStatusChange,
  onCancellationInfoChange
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [reviewedOrganization, setReviewedOrganization] = useState<Organization | null>(null);
  const { refreshOrganizations } = useOrganization();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch both subscription data and organization data
        const [subscriptionData, orgData] = await Promise.all([
          getSubscriptionApi(organizationId),
          getOrganizationApi(organizationId)
        ]);
        
        setPlans(subscriptionData.plans);
        setCurrentPlan(subscriptionData.current_plan);
        setSelectedPlan(subscriptionData.current_plan || 'individual');
        setHasPaymentMethod(subscriptionData.has_payment_method);
        setSubscriptionStatus(subscriptionData.subscription_status);
        setReviewedOrganization(orgData);
        
        // Notify parent component about payment method status
        if (onPaymentMethodStatusChange) {
          onPaymentMethodStatusChange(subscriptionData.has_payment_method);
        }
        
        // Notify parent component about subscription status
        if (onSubscriptionStatusChange) {
          onSubscriptionStatusChange(subscriptionData.subscription_status);
        }
        
        // Notify parent component about cancellation info
        if (onCancellationInfoChange) {
          onCancellationInfoChange(subscriptionData.cancel_at_period_end, subscriptionData.current_period_end);
        }
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
        toast.error(`Failed to load subscription plans: ${error}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, onPaymentMethodStatusChange, onSubscriptionStatusChange, onCancellationInfoChange]);

  const canChangeToPlan = (currentPlan: string | null, targetPlan: string): boolean => {
    if (!currentPlan) return true; // No current plan, can select any
    
    const planHierarchy = ['individual', 'team', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    const targetIndex = planHierarchy.indexOf(targetPlan);
    
    return targetIndex >= currentIndex; // Can only upgrade or stay same
  };

  const getPlanChangeReason = (currentPlan: string | null, targetPlan: string): string | null => {
    if (canChangeToPlan(currentPlan, targetPlan)) return null;
    
    return `Cannot downgrade from ${currentPlan} to ${targetPlan}. Contact support if you need to downgrade.`;
  };

  const handlePlanChange = async (planId: string) => {
    // Check if this is a reactivation (same plan, cancelling status)
    if (currentPlan === planId && subscriptionStatus === 'cancelling') {
      try {
        setLoading(true);
        
        // Reactivate the subscription
        await activateSubscriptionApi(organizationId);
        
        // Refresh the subscription plans data
        const subscriptionResponse = await getSubscriptionApi(organizationId);
        setSubscriptionStatus(subscriptionResponse.subscription_status);
        
        // Notify parent components
        if (onSubscriptionStatusChange) {
          onSubscriptionStatusChange(subscriptionResponse.subscription_status);
        }
        if (onCancellationInfoChange) {
          onCancellationInfoChange(subscriptionResponse.cancel_at_period_end, subscriptionResponse.current_period_end);
        }
        
        return;
      } catch (error) {
        console.error('Error reactivating subscription:', error);
        toast.error(`Failed to reactivate subscription: ${error}`);
        return;
      } finally {
        setLoading(false);
      }
    }

    // Check if payment method is set up
    if (!hasPaymentMethod) {
      const confirmed = window.confirm(
        'No payment method is set up. You will be redirected to set up payment before your plan change takes effect. Continue?'
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setLoading(true);
      setSelectedPlan(planId);
      
      // Step 1: Update the organization type
      await updateOrganizationApi(organizationId, { type: planId as 'individual' | 'team' | 'enterprise' });

      // Step 2: Activate the subscription
      await activateSubscriptionApi(organizationId);

      // Refresh the organization context to update parent component
      await refreshOrganizations();

      // Refresh the subscription plans data
      const subscriptionResponse = await getSubscriptionApi(organizationId);
      setCurrentPlan(planId);
      setSubscriptionStatus(subscriptionResponse.subscription_status);
      
      // Notify parent components
      if (onSubscriptionStatusChange) {
        onSubscriptionStatusChange(subscriptionResponse.subscription_status);
      }
      if (onCancellationInfoChange) {
        onCancellationInfoChange(subscriptionResponse.cancel_at_period_end, subscriptionResponse.current_period_end);
      }
      
      // Redirect to the customer portal only if no payment method is set up
      if (!subscriptionResponse.has_payment_method) {
        const portalResponse = await getCustomerPortalApi(organizationId);
        window.location.href = portalResponse.url;
      }
    } catch (error) {
      console.error('Error changing plan:', error);
      toast.error('Failed to change subscription plan');
      setSelectedPlan(currentPlan || 'individual');
    } finally {
      setLoading(false);
    }
  };

  // Filter plans based on organization type (minimum tier) and current plan tier
  const getVisiblePlans = (allPlans: SubscriptionPlan[], currentPlanType: string | null): SubscriptionPlan[] => {
    const planHierarchy = ['individual', 'team', 'enterprise'];
    
    // Get the organization type from the reviewed organization, not the current organization context
    const organizationType = reviewedOrganization?.type || 'individual';
    
    // Determine the minimum tier based on organization type
    const orgTypeIndex = planHierarchy.indexOf(organizationType);
    const minTierIndex = Math.max(orgTypeIndex, 0); // Ensure we don't go below individual
    
    // If there's a current plan, use the higher of organization type or current plan
    let effectiveMinIndex = minTierIndex;
    if (currentPlanType) {
      const currentIndex = planHierarchy.indexOf(currentPlanType);
      effectiveMinIndex = Math.max(minTierIndex, currentIndex);
    }
    
    // Always show the current plan and plans above it, regardless of organization type
    // This allows users to see their current plan even if it's below the organization's minimum tier
    return allPlans.filter(plan => {
      const planIndex = planHierarchy.indexOf(plan.plan_id);
      
      // Always include the current plan
      if (currentPlanType && plan.plan_id === currentPlanType) {
        return true;
      }
      
      // Include plans at or above the effective minimum tier
      return planIndex >= effectiveMinIndex;
    });
  };

  const getGridColsClass = (num: number) => {
    if (num === 1) return 'md:grid-cols-1';
    if (num === 2) return 'md:grid-cols-2';
    if (num >= 3) return 'md:grid-cols-3';
    return 'md:grid-cols-1';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const visiblePlans = getVisiblePlans(plans, currentPlan);

  return (
    <div className="w-full">
      {/* Plans Display */}
      <div className="flex justify-center">
        <div className={`grid grid-cols-1 ${getGridColsClass(visiblePlans.length)} gap-8`}>
          {visiblePlans.map((plan) => (
            <div
              key={plan.plan_id}
              className={`bg-white rounded-lg shadow-lg p-6 flex flex-col max-w-xs mx-auto ${
                selectedPlan === plan.plan_id ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex-grow">
                <h3 className="text-xl font-bold mb-4">{plan.name}</h3>
                <div className="text-3xl font-bold mb-4">
                  ${plan.base_price}
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
                    ${plan.metered_price} per SPU
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
                disabled={
                  (currentPlan === plan.plan_id && subscriptionStatus !== 'cancelling') || 
                  !canChangeToPlan(currentPlan, plan.plan_id)
                }
                title={getPlanChangeReason(currentPlan, plan.plan_id) || ''}
                className={`w-full py-2 px-4 rounded-md ${
                  currentPlan === plan.plan_id
                    ? subscriptionStatus === 'cancelling' 
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-300 cursor-not-allowed'
                    : !canChangeToPlan(currentPlan, plan.plan_id)
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : selectedPlan === plan.plan_id
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {currentPlan === plan.plan_id 
                  ? subscriptionStatus === 'cancelling' ? 'Reactivate Plan' : 'Current Plan'
                  : !canChangeToPlan(currentPlan, plan.plan_id)
                  ? 'Not Available'
                  : (selectedPlan === plan.plan_id && subscriptionStatus !== 'canceled' && subscriptionStatus !== 'no_subscription')
                    ? 'Selected Plan'
                    : 'Select Plan'
                }
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* SPU Information */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h4 className="text-sm font-medium text-blue-900 mb-2">About SPU (Service Processing Unit)</h4>
        <p className="text-sm text-blue-800">
          SPU is our flexible billing unit that allows for different pricing based on the complexity of document processing. 
          Currently, 1 page = 1 SPU. In the future, different LLM models may consume different SPU amounts per page, 
          allowing for more granular and fair pricing based on actual processing costs.
        </p>
      </div>
    </div>
  );
};

export default SubscriptionPlans; 