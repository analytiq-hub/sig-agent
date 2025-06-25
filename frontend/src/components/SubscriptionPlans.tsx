'use client'

import React, { useEffect, useState } from 'react';
import { getCustomerPortalApi, getSubscriptionPlansApi, updateOrganizationApi } from '@/utils/api';
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
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean>(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<number | null>(null);
  const { refreshOrganizations } = useOrganization();

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
        setCancelAtPeriodEnd(data.cancel_at_period_end);
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

  // Filter plans based on current plan tier
  const getVisiblePlans = (allPlans: SubscriptionPlan[], currentPlanType: string | null): SubscriptionPlan[] => {
    if (!currentPlanType) return allPlans; // Show all plans if no current plan
    
    const planHierarchy = ['individual', 'team', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(currentPlanType);
    
    // Only show plans at or above the current tier
    return allPlans.filter(plan => {
      const planIndex = planHierarchy.indexOf(plan.plan_id);
      return planIndex >= currentIndex;
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
            <p className="mt-2 text-sm text-orange-600">
              Your subscription will be cancelled on {formatDate(currentPeriodEnd)}. You can reactivate it anytime before then.
            </p>
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