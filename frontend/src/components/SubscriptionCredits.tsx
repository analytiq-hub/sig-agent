import React, { useEffect, useState } from 'react';
import { getCreditConfigApi, purchaseCreditsApi } from '@/utils/api';
import { toast } from 'react-toastify';

interface SubscriptionCreditsProps {
  organizationId: string;
  currentCredits: number;
  onClose: () => void;
}

const SubscriptionCredits: React.FC<SubscriptionCreditsProps> = ({ organizationId, currentCredits, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<{ price_per_credit: number; currency: string; min_cost: number; max_cost: number } | null>(null);
  const [amount, setAmount] = useState<number>(100);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const response = await getCreditConfigApi(organizationId);
        setConfig(response);
        setAmount(response.min_cost); // Changed from min_credits to min_cost
      } catch {
        setError('Failed to load credit purchase config.');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [organizationId]);

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    
    // Calculate cost for the requested amount
    const totalCost = amount * config.price_per_credit;
    
    if (totalCost < config.min_cost || totalCost > config.max_cost) {
      setError(`Purchase amount must be between $${config.min_cost} and $${config.max_cost}`);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const success_url = window.location.href;
      const cancel_url = window.location.href;
      const response = await purchaseCreditsApi(organizationId, { credits: amount, success_url, cancel_url });
      if (response.checkout_url) {
        window.location.href = response.checkout_url;
      } else {
        toast.error('Failed to start checkout.');
      }
    } catch (err: unknown) {
      let message = 'Failed to start checkout.';
      if (err instanceof Error) message = err.message;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-semibold mb-4">Purchase SPU Credits</h2>
        {loading && (
          <div className="flex justify-center items-center h-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        )}
        {!loading && config && (
          <form onSubmit={handlePurchase} className="space-y-4">
            <div>
              <label htmlFor="credit-amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount to Purchase
              </label>
              <input
                type="number"
                id="credit-amount"
                value={amount}
                onChange={e => setAmount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter number of credits"
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="text-sm text-gray-600">
              Price per credit: <span className="font-medium">{config.price_per_credit} {config.currency.toUpperCase()}</span>
            </div>
            <div className="text-lg font-bold text-blue-700">
              Total: {(amount * config.price_per_credit).toFixed(2)} {config.currency.toUpperCase()}
            </div>
            <div className="text-xs text-gray-500">
              Purchase amount must be between ${config.min_cost} and ${config.max_cost}.
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button
              type="submit"
              disabled={loading || amount <= 0 || (amount * config.price_per_credit) < config.min_cost || (amount * config.price_per_credit) > config.max_cost}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : `Purchase ${amount} Credits`}
            </button>
          </form>
        )}
        {!loading && !config && (
          <div className="text-red-600 text-sm">{error || 'Unable to load purchase options.'}</div>
        )}
        <div className="mt-4 text-xs text-gray-500">
          Credits are used before paid usage. You currently have <span className="font-semibold">{currentCredits}</span> credits remaining.
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCredits; 