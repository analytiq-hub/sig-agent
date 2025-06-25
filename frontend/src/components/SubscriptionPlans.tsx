'use client'

import React, { useEffect, useState } from 'react';
import { getCustomerPortalApi, getSubscriptionPlansApi, updateOrganizationApi, reactivateSubscriptionApi, cancelSubscriptionApi } from '@/utils/api';
import { toast } from 'react-toastify';
import type { SubscriptionPlan } from '@/types/payments';
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
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<number | null>(null);
  const { refreshOrganizations, currentOrganization } = useOrganization();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const data = await getSubscriptionPlansApi(organizationId);
        setPlans(data.plans);
        setCurrentPlan(data.current_plan);
        setSelectedPlan(data.current_plan || 'individual');
        setHasPaymentMethod(data.has_payment_method);
        setSubscriptionStatus(data.subscription_status);
        setCurrentPeriodEnd(data.current_period_end);
        
        // Notify parent component about payment method status
        if (onPaymentMethodStatusChange) {
          onPaymentMethodStatusChange(data.has_payment_method);
        }
        
        // Notify parent component about subscription status
        if (onSubscriptionStatusChange) {
          onSubscriptionStatusChange(data.subscription_status);
        }
        
        // Notify parent component about cancellation info
        if (onCancellationInfoChange) {
          onCancellationInfoChange(data.cancel_at_period_end, data.current_period_end);
        }
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
        toast.error('Failed to load subscription plans');
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
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
        await reactivateSubscriptionApi(organizationId);
        
        // Refresh the subscription plans data
        const subscriptionPlansResponse = await getSubscriptionPlansApi(organizationId);
        setSubscriptionStatus(subscriptionPlansResponse.subscription_status);
        setCurrentPeriodEnd(subscriptionPlansResponse.current_period_end);
        
        // Notify parent components
        if (onSubscriptionStatusChange) {
          onSubscriptionStatusChange(subscriptionPlansResponse.subscription_status);
        }
        if (onCancellationInfoChange) {
          onCancellationInfoChange(subscriptionPlansResponse.cancel_at_period_end, subscriptionPlansResponse.current_period_end);
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
      
      // Just update the organization type to match the new plan
      await updateOrganizationApi(organizationId, { type: planId as 'individual' | 'team' | 'enterprise' });

      // Refresh the organization context to update parent component
      await refreshOrganizations();

      // Refresh the subscription plans data
      const subscriptionPlansResponse = await getSubscriptionPlansApi(organizationId);
      setCurrentPlan(planId);
      setSubscriptionStatus(subscriptionPlansResponse.subscription_status);
      setCurrentPeriodEnd(subscriptionPlansResponse.current_period_end);
      
      // Notify parent components
      if (onSubscriptionStatusChange) {
        onSubscriptionStatusChange(subscriptionPlansResponse.subscription_status);
      }
      if (onCancellationInfoChange) {
        onCancellationInfoChange(subscriptionPlansResponse.cancel_at_period_end, subscriptionPlansResponse.current_period_end);
      }
      
      // Redirect to the customer portal only if no payment method is set up
      if (!subscriptionPlansResponse.has_payment_method) {
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

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period.'
    );
    
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      
      // Call the cancel subscription API
      await cancelSubscriptionApi(organizationId);
      
      // Refresh the subscription plans data
      const subscriptionPlansResponse = await getSubscriptionPlansApi(organizationId);
      setSubscriptionStatus(subscriptionPlansResponse.subscription_status);
      setCurrentPeriodEnd(subscriptionPlansResponse.current_period_end);
      
      // Notify parent components
      if (onSubscriptionStatusChange) {
        onSubscriptionStatusChange(subscriptionPlansResponse.subscription_status);
      }
      if (onCancellationInfoChange) {
        onCancellationInfoChange(subscriptionPlansResponse.cancel_at_period_end, subscriptionPlansResponse.current_period_end);
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  // Filter plans based on organization type (minimum tier) and current plan tier
  const getVisiblePlans = (allPlans: SubscriptionPlan[], currentPlanType: string | null): SubscriptionPlan[] => {
    const planHierarchy = ['individual', 'team', 'enterprise'];
    
    // Get the organization type from the current organization context
    const organizationType = currentOrganization?.type || 'individual';
    
    // Determine the minimum tier based on organization type
    const orgTypeIndex = planHierarchy.indexOf(organizationType);
    const minTierIndex = Math.max(orgTypeIndex, 0); // Ensure we don't go below individual
    
    // If there's a current plan, use the higher of organization type or current plan
    let effectiveMinIndex = minTierIndex;
    if (currentPlanType) {
      const currentIndex = planHierarchy.indexOf(currentPlanType);
      effectiveMinIndex = Math.max(minTierIndex, currentIndex);
    }
    
    // Only show plans at or above the effective minimum tier
    return allPlans.filter(plan => {
      const planIndex = planHierarchy.indexOf(plan.plan_id);
      return planIndex >= effectiveMinIndex;
    });
  };

  const getGridColsClass = (num: number) => {
    if (num === 1) return 'md:grid-cols-1';
    if (num === 2) return 'md:grid-cols-2';
    if (num >= 3) return 'md:grid-cols-3';
    return 'md:grid-cols-1';
  };

  const getSubscriptionStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    const statusConfig = {
      'active': { color: 'bg-green-100 text-green-800', text: 'Active' },
      'cancelling': { color: 'bg-orange-100 text-orange-800', text: 'Cancelling' },
      'canceled': { color: 'bg-red-100 text-red-800', text: 'Cancelled' },
      'past_due': { color: 'bg-yellow-100 text-yellow-800', text: 'Past Due' },
      'unpaid': { color: 'bg-red-100 text-red-800', text: 'Unpaid' },
      'incomplete': { color: 'bg-blue-100 text-blue-800', text: 'Incomplete' },
      'incomplete_expired': { color: 'bg-gray-100 text-gray-800', text: 'Expired' },
      'trialing': { color: 'bg-purple-100 text-purple-800', text: 'Trial' },
      'no_subscription': { color: 'bg-gray-100 text-gray-800', text: 'No Subscription' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['no_subscription'];
    
    return (
      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </div>
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
      {/* Subscription Status Display */}
      {subscriptionStatus && (
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2">
            <span className="text-sm text-gray-600">Subscription Status:</span>
            {getSubscriptionStatusBadge(subscriptionStatus)}
          </div>
          {subscriptionStatus === 'cancelling' && currentPeriodEnd && (
            <div className="mt-2">
              <p className="text-sm text-orange-600 mb-2">
                Your subscription will be cancelled on {formatDate(currentPeriodEnd)}. You can reactivate it anytime before then.
              </p>
              <button
                onClick={() => handlePlanChange(currentPlan || 'individual')}
                disabled={loading}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                ) : (
                  <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Reactivate Now
              </button>
            </div>
          )}
          {subscriptionStatus === 'active' && (
            <div className="mt-2">
              <button
                onClick={handleCancelSubscription}
                disabled={loading}
                className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-1"></div>
                ) : (
                  <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                Cancel Subscription
              </button>
            </div>
          )}
          {subscriptionStatus === 'canceled' && (
            <p className="mt-2 text-sm text-gray-500">
              Your subscription has been cancelled. You can reactivate it by selecting a plan below.
            </p>
          )}
          {subscriptionStatus === 'past_due' && (
            <p className="mt-2 text-sm text-yellow-600">
              Your payment is past due. Please update your payment method to continue service.
            </p>
          )}
        </div>
      )}
      
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
                disabled={currentPlan === plan.plan_id || !canChangeToPlan(currentPlan, plan.plan_id)}
                title={getPlanChangeReason(currentPlan, plan.plan_id) || ''}
                className={`w-full py-2 px-4 rounded-md ${
                  currentPlan === plan.plan_id
                    ? 'bg-gray-300 cursor-not-allowed'
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
                  : selectedPlan === plan.plan_id 
                  ? 'Selected Plan' 
                  : 'Select Plan'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPlans; 