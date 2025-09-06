'use client'

import React, { useEffect, useState } from 'react';
import { getUsageRangeApi } from '@/utils/api';
import { UsageRangeRequest, UsageRangeResponse, UsageDataPoint } from '@/types/payments';
import { toast } from 'react-toastify';

interface SubscriptionSPUUsageChartProps {
  organizationId: string;
  refreshKey?: number;
}

interface ProcessedDataPoint {
  date: string;
  spus: number;
  cumulative_spus: number;
  operation: string;
  source: string;
}

const SubscriptionSPUUsageChart: React.FC<SubscriptionSPUUsageChartProps> = ({ organizationId, refreshKey }) => {
  const [rangeData, setRangeData] = useState<UsageRangeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<'daily' | 'monthly'>('daily');
  const [viewType, setViewType] = useState<'bar' | 'cumulative'>('bar');
  const [processedData, setProcessedData] = useState<ProcessedDataPoint[]>([]);

  // Single useEffect that handles both initial fetch and refresh
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Calculate billing period inside the effect to avoid dependency issues
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const request: UsageRangeRequest = {
          start_date: startOfMonth.toISOString().split('T')[0],
          end_date: endOfMonth.toISOString().split('T')[0]
        };
        
        const response = await getUsageRangeApi(organizationId, request);
        setRangeData(response);
      } catch (error) {
        console.error('Error fetching usage range:', error);
        toast.error('Failed to load usage range data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, refreshKey]);

  useEffect(() => {
    if (rangeData) {
      const processData = (data: UsageDataPoint[]) => {
        if (!data || data.length === 0) return [];

        // Sort data by date
        const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let processed: ProcessedDataPoint[] = [];
        let cumulative = 0;

        if (granularity === 'daily') {
          // Use daily data as-is
          processed = sortedData.map(point => {
            cumulative += point.spus;
            return {
              ...point,
              cumulative_spus: cumulative
            };
          });
        } else {
          // Aggregate to monthly data
          const monthlyMap = new Map<string, { spus: number; operations: string[]; sources: string[] }>();
          
          sortedData.forEach(point => {
            const date = new Date(point.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyMap.has(monthKey)) {
              monthlyMap.set(monthKey, { spus: 0, operations: [], sources: [] });
            }
            
            const monthData = monthlyMap.get(monthKey)!;
            monthData.spus += point.spus;
            if (!monthData.operations.includes(point.operation)) {
              monthData.operations.push(point.operation);
            }
            if (!monthData.sources.includes(point.source)) {
              monthData.sources.push(point.source);
            }
          });

          // Convert to processed data points
          processed = Array.from(monthlyMap.entries()).map(([monthKey, data]) => {
            cumulative += data.spus;
            return {
              date: `${monthKey}-01`, // Use first day of month for display
              spus: data.spus,
              cumulative_spus: cumulative,
              operation: data.operations[0] || 'unknown',
              source: data.sources[0] || 'unknown'
            };
          });
        }

        return processed;
      };

      const processed = processData(rangeData.data_points);
      setProcessedData(processed);
    }
  }, [rangeData, granularity]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (granularity === 'daily') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  };

  const formatPeriod = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const startStr = startOfMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endOfMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    return `${startStr} - ${endStr} (Calendar Month)`;
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!rangeData || processedData.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">SPU Usage Analytics</h3>
        <div className="text-center text-gray-500 py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No usage data available for the selected period.</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...processedData.map(dp => 
    viewType === 'cumulative' ? dp.cumulative_spus : dp.spus
  ));

  const averageDailySpus = rangeData.total_spus / Math.max(processedData.length, 1);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">SPU Usage Analytics</h3>
          <p className="text-sm text-gray-600 mt-1">
            {formatPeriod()}
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setGranularity('daily')}
              className={`px-3 py-2 text-sm font-medium rounded-l-md border ${
                granularity === 'daily'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setGranularity('monthly')}
              className={`px-3 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                granularity === 'monthly'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Monthly
            </button>
          </div>
          
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setViewType('bar')}
              className={`px-3 py-2 text-sm font-medium rounded-l-md border ${
                viewType === 'bar'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Bar
            </button>
            <button
              onClick={() => setViewType('cumulative')}
              className={`px-3 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                viewType === 'cumulative'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Cumulative
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm font-medium text-blue-600">Total SPUs</div>
          <div className="text-2xl font-bold text-blue-900">{rangeData.total_spus.toLocaleString()}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm font-medium text-green-600">Average Daily</div>
          <div className="text-2xl font-bold text-green-900">{averageDailySpus.toFixed(1)}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-end justify-between h-64 gap-1">
          {processedData.map((point, index) => {
            const value = viewType === 'cumulative' ? point.cumulative_spus : point.spus;
            const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
            
            return (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className="relative group">
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${
                      viewType === 'cumulative' 
                        ? 'bg-gradient-to-t from-blue-500 to-blue-400' 
                        : 'bg-gradient-to-t from-green-500 to-green-400'
                    }`}
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  ></div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    <div className="font-medium">{formatDate(point.date)}</div>
                    <div>{viewType === 'cumulative' ? 'Cumulative' : 'Daily'}: {value.toLocaleString()} SPUs</div>
                    {viewType === 'bar' && (
                      <div>Operation: {point.operation}</div>
                    )}
                  </div>
                </div>
                
                {/* X-axis labels */}
                <div className="text-xs text-gray-600 mt-2 text-center">
                  {formatDate(point.date)}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Y-axis labels */}
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>0</span>
          <span>{Math.round(maxValue / 2).toLocaleString()}</span>
          <span>{maxValue.toLocaleString()}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded mr-2 ${viewType === 'cumulative' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
          <span className="text-gray-600">
            {viewType === 'cumulative' ? 'Cumulative SPUs' : 'Daily SPUs'}
          </span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded mr-2 bg-gray-400"></div>
          <span className="text-gray-600">{granularity === 'daily' ? 'Daily View' : 'Monthly View'}</span>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSPUUsageChart;
