'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DocRouterOrgApi } from '@/utils/api';
import { Box, Typography, Grid, ToggleButton, ToggleButtonGroup, CircularProgress, Button, TextField, Paper, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, FormControlLabel, Checkbox, FormGroup } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  Speed as PerformanceIcon,
  DateRange as DateRangeIcon,
  Schedule as ScheduleIcon,
  Close as CloseIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import StatCard from './analytics/StatCard';
import TimeSeriesChart, { TimeSeriesDataPoint } from './analytics/TimeSeriesChart';
import LogViewer, { LogEntry } from './analytics/LogViewer';
import TokenBreakdownCard from './analytics/TokenBreakdownCard';
import BarChart, { BarChartDataPoint } from './analytics/BarChart';
import { 
  DataPoint, 
  ResourceAttribute, 
  TelemetryMetricResponse, 
  TelemetryLogResponse 
} from '@docrouter/sdk';

interface TelemetryAnalyticsDashboardProps {
  organizationId: string;
}

type TimeRange = '1h' | '6h' | '24h' | '7d' | 'custom';
type DisplayMode = 'cumulative' | 'rate';

const TelemetryAnalyticsDashboard: React.FC<TelemetryAnalyticsDashboardProps> = ({ organizationId }) => {
  const docRouterOrgApi = useMemo(() => new DocRouterOrgApi(organizationId), [organizationId]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('cumulative');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TelemetryMetricResponse[]>([]);
  const [logs, setLogs] = useState<TelemetryLogResponse[]>([]);
  
  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isCustomDateModalOpen, setIsCustomDateModalOpen] = useState<boolean>(false);

  // Stats state
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalCost: 0,
    totalTokens: 0,
    linesOfCode: 0
  });

  // Token breakdown state
  const [tokenBreakdown, setTokenBreakdown] = useState({
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0
  });

  // Tool usage state
  const [toolUsageData, setToolUsageData] = useState<BarChartDataPoint[]>([]);
  const [toolAverageDuration, setToolAverageDuration] = useState<Record<string, number>>({});

  // Time series data
  const [costData, setCostData] = useState<TimeSeriesDataPoint[]>([]);
  const [tokenData, setTokenData] = useState<TimeSeriesDataPoint[]>([]);

  // Token type selection state
  const [enabledTokenTypes, setEnabledTokenTypes] = useState<Record<string, boolean>>({
    input_tokens: true,
    output_tokens: true,
    cache_read_tokens: true,
    cache_creation_tokens: true
  });

  // Language model selection state
  const [enabledLanguageModels, setEnabledLanguageModels] = useState<Record<string, boolean>>({});

  // Logs data
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  const getTimeRangeMs = useCallback((range: TimeRange): number => {
    switch (range) {
      case '1h': return 60 * 60 * 1000;
      case '6h': return 6 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case 'custom': 
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          return end.getTime() - start.getTime();
        }
        return 60 * 60 * 1000; // fallback to 1h
      default: return 60 * 60 * 1000;
    }
  }, [customStartDate, customEndDate]);

  // Calculate appropriate time interval for rate calculation
  const getTimeInterval = useCallback((range: TimeRange): { intervalMs: number; label: string } => {
    switch (range) {
      case '1h': return { intervalMs: 5 * 60 * 1000, label: 'per 5 min' }; // 5 minutes
      case '6h': return { intervalMs: 30 * 60 * 1000, label: 'per 30 min' }; // 30 minutes
      case '24h': return { intervalMs: 2 * 60 * 60 * 1000, label: 'per 2 hours' }; // 2 hours
      case '7d': return { intervalMs: 24 * 60 * 60 * 1000, label: 'per day' }; // 1 day
      case 'custom': 
        const customMs = getTimeRangeMs('custom');
        if (customMs <= 6 * 60 * 60 * 1000) return { intervalMs: 30 * 60 * 1000, label: 'per 30 min' };
        if (customMs <= 24 * 60 * 60 * 1000) return { intervalMs: 2 * 60 * 60 * 1000, label: 'per 2 hours' };
        return { intervalMs: 24 * 60 * 60 * 1000, label: 'per day' };
      default: return { intervalMs: 5 * 60 * 1000, label: 'per 5 min' };
    }
  }, [getTimeRangeMs]);

  // Convert cumulative data to rate data
  const convertToRateData = useCallback((data: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] => {
    if (data.length < 2) return data;
    
    const rateData: TimeSeriesDataPoint[] = [];
    const { intervalMs } = getTimeInterval(timeRange);
    
    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      const timeDiffMs = Number(current.timestamp) - Number(previous.timestamp);
      
      if (timeDiffMs > 0) {
        const ratePoint: TimeSeriesDataPoint = { timestamp: current.timestamp };
        
        // Calculate rate for each data key (excluding timestamp)
        Object.keys(current).forEach(key => {
          if (key !== 'timestamp') {
            const currentValue = Number(current[key]) || 0;
            const previousValue = Number(previous[key]) || 0;
            const delta = currentValue - previousValue;
            
            // Calculate rate: delta per interval
            // If timeDiff is 10 minutes and interval is 5 minutes, rate = delta * (5/10) = delta * 0.5
            const rate = delta * (intervalMs / timeDiffMs);
            ratePoint[key] = Math.max(0, rate); // Ensure non-negative rates
          }
        });
        
        rateData.push(ratePoint);
      }
    }
    
    return rateData;
  }, [timeRange, getTimeInterval]);

  // Filter token data based on enabled language models
  const filterTokenDataByModels = useCallback((data: TimeSeriesDataPoint[], logsData: TelemetryLogResponse[]): TimeSeriesDataPoint[] => {
    if (Object.keys(enabledLanguageModels).length === 0) return data;
    
    // Create a map of timestamps to enabled models
    const timestampToModels: Record<number, Set<string>> = {};
    
    logsData.forEach(log => {
      if (log.attributes && log.attributes.model) {
        const model = log.attributes.model as string;
        const timestamp = new Date(log.timestamp).getTime();
        
        if (!timestampToModels[timestamp]) {
          timestampToModels[timestamp] = new Set();
        }
        timestampToModels[timestamp].add(model);
      }
    });
    
    // Filter data points to only include those with enabled models
    return data.filter(point => {
      const modelsAtTime = timestampToModels[Number(point.timestamp)];
      if (!modelsAtTime) return true; // Keep if no model info available
      
      // Check if any enabled model was active at this timestamp
      return Array.from(modelsAtTime).some(model => enabledLanguageModels[model as string] !== false);
    });
  }, [enabledLanguageModels]);

  // Helper function to format date for datetime-local input
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().slice(0, 16);
  };

  // Helper function to format date range for display
  const formatDateRangeForDisplay = (startDate: string, endDate: string): string => {
    if (!startDate || !endDate) return 'Select date range';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const formatOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    
    const startStr = start.toLocaleDateString('en-US', formatOptions);
    const endStr = end.toLocaleDateString('en-US', formatOptions);
    
    return `${startStr} - ${endStr}`;
  };


  // Initialize custom date range with default values
  useEffect(() => {
    if (timeRange === 'custom' && !customStartDate && !customEndDate) {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const defaultRange = {
        start: formatDateForInput(yesterday),
        end: formatDateForInput(now)
      };
      setCustomStartDate(defaultRange.start);
      setCustomEndDate(defaultRange.end);
    }
  }, [timeRange, customStartDate, customEndDate]);

  const processMetricsData = useCallback((metricsData: TelemetryMetricResponse[], startTime: Date, endTime?: Date) => {
    // Filter metrics by time range first
    const filteredMetrics = metricsData.filter(metric => {
      const uploadDate = new Date(metric.upload_date);
      const isAfterStart = uploadDate >= startTime;
      const isBeforeEnd = endTime ? uploadDate <= endTime : true;
      return isAfterStart && isBeforeEnd;
    });

    // Extract relevant metrics by name patterns (more flexible matching)
    const sessionMetrics = filteredMetrics.filter(m => 
      m.name && (m.name.toLowerCase().includes('session') || m.name.toLowerCase().includes('request'))
    );
    const locMetrics = filteredMetrics.filter(m => 
      m.name && (m.name.toLowerCase().includes('code') || m.name.toLowerCase().includes('line'))
    );

    // Calculate totals
    let totalSessions = 0;
    let linesOfCode = 0;

    sessionMetrics.forEach(metric => {
      if (metric.data_points && Array.isArray(metric.data_points)) {
        metric.data_points.forEach((dp: DataPoint) => {
          const timestamp = parseInt(dp.timeUnixNano) / 1000000;
          const dataPointTime = new Date(timestamp);
          
          // Only include data points within the time range
          const isAfterStart = dataPointTime >= startTime;
          const isBeforeEnd = endTime ? dataPointTime <= endTime : true;
          if (isAfterStart && isBeforeEnd) {
            const value = dp.value?.asDouble || dp.value?.asInt || 0;
            totalSessions += typeof value === 'string' ? parseFloat(value) : value;
          }
        });
      }
    });



    locMetrics.forEach(metric => {
      if (metric.data_points && Array.isArray(metric.data_points)) {
        metric.data_points.forEach((dp: DataPoint) => {
          const timestamp = parseInt(dp.timeUnixNano) / 1000000;
          const dataPointTime = new Date(timestamp);
          
          // Only include data points within the time range
          const isAfterStart = dataPointTime >= startTime;
          const isBeforeEnd = endTime ? dataPointTime <= endTime : true;
          if (isAfterStart && isBeforeEnd) {
            const value = dp.value?.asDouble || dp.value?.asInt || 0;
            linesOfCode += typeof value === 'string' ? parseFloat(value) : value;
          }
        });
      }
    });

    setStats({
      totalSessions: Math.round(totalSessions),
      totalCost: 0, // Will be calculated from logs
      totalTokens: 0, // Will be calculated from logs
      linesOfCode: Math.round(linesOfCode)
    });


    // Tool usage data is now processed from logs, not metrics
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processLogsData = useCallback((logsData: TelemetryLogResponse[], startTime: Date, endTime?: Date) => {
    const entries: LogEntry[] = logsData
      .filter(log => log.body)
      .filter(log => {
        // Filter logs by time range
        const logTime = new Date(log.timestamp);
        const isAfterStart = logTime >= startTime;
        const isBeforeEnd = endTime ? logTime <= endTime : true;
        return isAfterStart && isBeforeEnd;
      })
      .map(log => {
        // Determine log level from severity field
        let level: 'info' | 'success' | 'error' | 'warning' = 'info';
        if (log.severity) {
          const severity = log.severity.toLowerCase();
          if (severity.includes('error') || severity.includes('fatal')) level = 'error';
          else if (severity.includes('warn')) level = 'warning';
          else if (severity.includes('success') || severity.includes('info')) level = 'success';
        }

        // Extract timestamp - use timestamp field directly
        const timestamp = log.timestamp 
          ? new Date(log.timestamp)
          : new Date(log.upload_date || Date.now());

        // Get message
        const message = typeof log.body === 'string' ? log.body : JSON.stringify(log.body);

        // Extract metadata from resource attributes
        const metadata: Record<string, unknown> = {};
        if (log.resource?.attributes && Array.isArray(log.resource.attributes)) {
          log.resource.attributes.forEach((attr: ResourceAttribute) => {
            if (attr.value?.stringValue) {
              metadata[attr.key] = attr.value.stringValue;
            } else if (attr.value?.intValue !== undefined) {
              metadata[attr.key] = attr.value.intValue;
            } else if (attr.value?.boolValue !== undefined) {
              metadata[attr.key] = attr.value.boolValue;
            }
          });
        }

        // Add log attributes to metadata if available
        if (log.attributes && typeof log.attributes === 'object') {
          Object.assign(metadata, log.attributes);
        }

        return {
          timestamp,
          level,
          message,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50); // Limit to 50 most recent entries

    setLogEntries(entries);
  }, []);

  const processTokenUsageFromLogs = useCallback((logsData: TelemetryLogResponse[], startTime: Date, endTime?: Date): TimeSeriesDataPoint[] => {
    console.log('Processing token data from logs...');
    console.log('Total logs available:', logsData.length);
    console.log('Time range:', startTime.toISOString(), 'to', endTime?.toISOString() || 'now');

    const detectedTokenTypes: Set<string> = new Set();
    const tokenEntries: Array<{ timestamp: number; tokenType: string; tokens: number; model: string }> = [];

    // Process all logs to find token-related entries
    logsData.forEach(log => {
      const logTime = new Date(log.timestamp);
      const isAfterStart = logTime >= startTime;
      const isBeforeEnd = endTime ? logTime <= endTime : true;
      
      if (!isAfterStart || !isBeforeEnd) return;

      const body = typeof log.body === 'string' ? log.body : JSON.stringify(log.body);
      
      // Debug: Log each log to understand the structure
      console.log('Analyzing log for tokens:', {
        timestamp: log.timestamp,
        body: body.substring(0, 300) + (body.length > 300 ? '...' : ''),
        attributes: log.attributes,
        resource: log.resource
      });

      // Check log attributes for token information (this is where the real data is)
      if (log.attributes && typeof log.attributes === 'object') {
        const tokenFields = {
          'input_tokens': log.attributes.input_tokens,
          'output_tokens': log.attributes.output_tokens,
          'cache_read_tokens': log.attributes.cache_read_tokens,
          'cache_creation_tokens': log.attributes.cache_creation_tokens
        };
        
        // Get model information
        const model = log.attributes.model as string || 'unknown';
        
        Object.entries(tokenFields).forEach(([tokenType, tokenCount]) => {
          // Parse token count as number (can be string or number)
          const parsedCount = typeof tokenCount === 'string' ? parseInt(tokenCount, 10) : (typeof tokenCount === 'number' ? tokenCount : 0);
          
          if (parsedCount && !isNaN(parsedCount) && parsedCount > 0) {
            console.log('Found token entry:', { 
              timestamp: log.timestamp, 
              tokenType, 
              tokens: parsedCount, 
              model,
              originalValue: tokenCount,
              attributes: log.attributes 
            });
            detectedTokenTypes.add(tokenType);
            tokenEntries.push({
              timestamp: logTime.getTime(),
              tokenType,
              tokens: parsedCount,
              model
            });
          }
        });
      }
    });

    console.log('Total token entries found:', tokenEntries.length);
    console.log('Detected token types:', Array.from(detectedTokenTypes));

    // If no token data found, return empty array (no bogus data)
    if (tokenEntries.length === 0) {
      console.log('No token data found in logs. Returning empty token data.');
      return [];
    }

    // Sort token entries by timestamp
    tokenEntries.sort((a, b) => a.timestamp - b.timestamp);

    // Create incremental token data starting from 0
    const tokenTimeSeries: TimeSeriesDataPoint[] = [];
    const tokenTotals: Record<string, number> = {};
    
    // Initialize all token types to 0
    detectedTokenTypes.forEach(tokenType => {
      tokenTotals[tokenType] = 0;
    });

    // Add starting point at the beginning of the time range (all token types at 0)
    tokenTimeSeries.push({
      timestamp: startTime.getTime(),
      ...tokenTotals
    });

    // Process each token entry and create incremental data points
    tokenEntries.forEach(entry => {
      // Update the running total for this token type
      tokenTotals[entry.tokenType] += entry.tokens;
      
      // Create a data point with current totals
      const dataPoint: TimeSeriesDataPoint = {
        timestamp: entry.timestamp,
        ...tokenTotals
      };
      
      tokenTimeSeries.push(dataPoint);
    });

    console.log('Generated incremental token data:', tokenTimeSeries);
    console.log('Final token totals:', tokenTotals);
    
    // Update token breakdown state
    setTokenBreakdown({
      input_tokens: tokenTotals.input_tokens || 0,
      output_tokens: tokenTotals.output_tokens || 0,
      cache_read_tokens: tokenTotals.cache_read_tokens || 0,
      cache_creation_tokens: tokenTotals.cache_creation_tokens || 0
    });
    
    return tokenTimeSeries.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  }, []);

  const processToolUsageFromLogs = useCallback((logsData: TelemetryLogResponse[], startTime: Date, endTime?: Date): { usageData: BarChartDataPoint[], averageDuration: Record<string, number> } => {
    console.log('Processing tool usage data from logs...');
    console.log('Total logs available:', logsData.length);
    console.log('Time range:', startTime.toISOString(), 'to', endTime?.toISOString() || 'now');

    const toolUsageCounts: Record<string, number> = {};
    const toolDurations: Record<string, number[]> = {};

    // Process all logs to find tool_result entries
    logsData.forEach(log => {
      const logTime = new Date(log.timestamp);
      const isAfterStart = logTime >= startTime;
      const isBeforeEnd = !endTime || logTime <= endTime;

      if (!isAfterStart || !isBeforeEnd) return;

      // Check if this is a tool_result log
      if (log.body === 'claude_code.tool_result' && log.attributes && typeof log.attributes === 'object') {
        const toolName = log.attributes.tool_name as string;
        const success = log.attributes.success as string;
        const duration = log.attributes.duration_ms as string;

        if (toolName && success === 'true' && duration) {
          const parsedDuration = typeof duration === 'string' ? parseInt(duration, 10) : (typeof duration === 'number' ? duration : 0);
          
          if (!isNaN(parsedDuration) && parsedDuration > 0) {
            console.log('Found tool usage:', { 
              timestamp: log.timestamp, 
              toolName, 
              duration: parsedDuration,
              attributes: log.attributes 
            });

            // Count tool usage
            toolUsageCounts[toolName] = (toolUsageCounts[toolName] || 0) + 1;
            
            // Track durations for average calculation
            if (!toolDurations[toolName]) {
              toolDurations[toolName] = [];
            }
            toolDurations[toolName].push(parsedDuration);
          }
        }
      }
    });

    console.log('Tool usage counts:', toolUsageCounts);
    console.log('Tool durations:', toolDurations);

    // Convert to bar chart data format
    const usageData: BarChartDataPoint[] = Object.entries(toolUsageCounts)
      .map(([toolName, count]) => ({
        name: toolName.replace('mcp__docrouter__', ''), // Clean up tool names
        value: count,
        fullName: toolName
      }))
      .sort((a, b) => b.value - a.value); // Sort by usage count descending

    // Calculate average durations
    const averageDuration: Record<string, number> = {};
    Object.entries(toolDurations).forEach(([toolName, durations]) => {
      const avg = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
      averageDuration[toolName] = Math.round(avg);
    });

    console.log('Generated tool usage data:', usageData);
    console.log('Average durations:', averageDuration);

    return { usageData, averageDuration };
  }, []);

  const processCostDataFromLogs = useCallback((logsData: TelemetryLogResponse[], startTime: Date, endTime?: Date): TimeSeriesDataPoint[] => {
    console.log('Processing cost data from logs...');
    console.log('Total logs available:', logsData.length);
    console.log('Time range:', startTime.toISOString(), 'to', endTime?.toISOString() || 'now');

    const detectedModels: Set<string> = new Set();
    const costEntries: Array<{ timestamp: number; model: string; cost: number }> = [];

    // Process all logs to find cost-related entries
    logsData.forEach(log => {
      const logTime = new Date(log.timestamp);
      const isAfterStart = logTime >= startTime;
      const isBeforeEnd = endTime ? logTime <= endTime : true;
      
      if (!isAfterStart || !isBeforeEnd) return;

      const body = typeof log.body === 'string' ? log.body : JSON.stringify(log.body);
      
      // Debug: Log each log to understand the structure
      console.log('Analyzing log:', {
        timestamp: log.timestamp,
        body: body.substring(0, 300) + (body.length > 300 ? '...' : ''),
        attributes: log.attributes,
        resource: log.resource
      });

      // Check log attributes for cost information (this is where the real data is)
      if (log.attributes && typeof log.attributes === 'object') {
        const cost = log.attributes.cost_usd;
        const model = log.attributes.model;
        
        // Parse cost as number (can be string or number)
        const parsedCost = typeof cost === 'string' ? parseFloat(cost) : (typeof cost === 'number' ? cost : 0);
        
        if (parsedCost && !isNaN(parsedCost) && parsedCost > 0 && model && typeof model === 'string') {
          console.log('Found cost entry from attributes:', { 
            timestamp: log.timestamp, 
            model, 
            cost: parsedCost, 
            originalValue: cost,
            attributes: log.attributes 
          });
          detectedModels.add(model);
          costEntries.push({
            timestamp: logTime.getTime(),
            model,
            cost: parsedCost
          });
        }
      }
    });

    console.log('Total cost entries found:', costEntries.length);
    console.log('Detected models:', Array.from(detectedModels));

    // Initialize enabled language models if not set
    if (Object.keys(enabledLanguageModels).length === 0 && detectedModels.size > 0) {
      const initialModelState: Record<string, boolean> = {};
      detectedModels.forEach(model => {
        initialModelState[model] = true;
      });
      setEnabledLanguageModels(initialModelState);
    }

    // If no cost data found, return empty array (no bogus data)
    if (costEntries.length === 0) {
      console.log('No cost data found in logs. Returning empty cost data.');
      return [];
    }

    // Sort cost entries by timestamp
    costEntries.sort((a, b) => a.timestamp - b.timestamp);

    // Create incremental cost data starting from 0
    const costTimeSeries: TimeSeriesDataPoint[] = [];
    const modelTotals: Record<string, number> = {};
    
    // Initialize all models to 0
    detectedModels.forEach(model => {
      modelTotals[model] = 0;
    });

    // Add starting point at the beginning of the time range (all models at 0)
    costTimeSeries.push({
      timestamp: startTime.getTime(),
      ...modelTotals
    });

    // Process each cost entry and create incremental data points
    costEntries.forEach(entry => {
      // Update the running total for this model
      modelTotals[entry.model] += entry.cost;
      
      // Create a data point with current totals
      const dataPoint: TimeSeriesDataPoint = {
        timestamp: entry.timestamp,
        ...modelTotals
      };
      
      costTimeSeries.push(dataPoint);
    });

    console.log('Generated incremental cost data:', costTimeSeries);
    console.log('Final model totals:', modelTotals);
    
    return costTimeSeries.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  }, [enabledLanguageModels]);

  const loadAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate organization ID
      if (!organizationId || organizationId.trim() === '') {
        throw new Error('Organization ID is required');
      }

      console.log('Loading analytics data for organization:', organizationId);

      // Calculate time range for filtering
      let startTime: Date;
      let endTime: Date;
      
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        // Convert local time to UTC for comparison with UTC metrics
        startTime = new Date(customStartDate);
        endTime = new Date(customEndDate);
        
        // The datetime-local input gives us local time, but we need to ensure
        // we're comparing with UTC timestamps from the metrics
        console.log('Custom date range - Local start:', customStartDate, 'UTC start:', startTime.toISOString());
        console.log('Custom date range - Local end:', customEndDate, 'UTC end:', endTime.toISOString());
      } else {
        const now = new Date();
        const timeRangeMs = getTimeRangeMs(timeRange);
        startTime = new Date(now.getTime() - timeRangeMs);
        endTime = now;
      }

      // Fetch metrics from the existing API (API limit is 100)
      console.log('Fetching metrics for organization:', organizationId);
      let metricsResponse;
      try {
        metricsResponse = await docRouterOrgApi.listMetrics({ limit: 100 });
        console.log('Metrics response:', metricsResponse);
        setMetrics(metricsResponse.metrics || []);
      } catch (metricsError) {
        console.warn('Failed to fetch metrics:', metricsError);
        setMetrics([]);
        metricsResponse = { metrics: [] };
      }

      // Fetch logs (API limit is 100)
      console.log('Fetching logs for organization:', organizationId);
      let logsResponse;
      try {
        logsResponse = await docRouterOrgApi.listLogs({ limit: 100 });
        console.log('Logs response:', logsResponse);
        setLogs(logsResponse.logs || []);
      } catch (logsError) {
        console.warn('Failed to fetch logs:', logsError);
        setLogs([]);
        logsResponse = { logs: [] };
      }

      // Process metrics data with time filtering
      processMetricsData(metricsResponse.metrics || [], startTime, endTime);
      processLogsData(logsResponse.logs || [], startTime, endTime);
      
      // Process token usage from logs instead of metrics
      const tokenDataFromLogs = processTokenUsageFromLogs(logsResponse.logs || [], startTime, endTime);
      setTokenData(tokenDataFromLogs);
      
      // Process cost data from logs instead of metrics
      const costDataFromLogs = processCostDataFromLogs(logsResponse.logs || [], startTime, endTime);
      setCostData(costDataFromLogs);
      
      // Process tool usage from logs
      const toolUsageResult = processToolUsageFromLogs(logsResponse.logs || [], startTime, endTime);
      setToolUsageData(toolUsageResult.usageData);
      setToolAverageDuration(toolUsageResult.averageDuration);
      
      // Calculate total tokens from logs
      const totalTokensFromLogs = tokenDataFromLogs.reduce((total, point) => {
        let pointTotal = 0;
        Object.keys(point).forEach(key => {
          if (key !== 'timestamp') {
            pointTotal += point[key] as number;
          }
        });
        return total + pointTotal;
      }, 0);
      
      // Calculate total cost from logs
      const totalCostFromLogs = costDataFromLogs.reduce((total, point) => {
        let pointTotal = 0;
        Object.keys(point).forEach(key => {
          if (key !== 'timestamp') {
            pointTotal += point[key] as number;
          }
        });
        return total + pointTotal;
      }, 0);
      
      // Update stats with totals from logs
      setStats(prevStats => ({
        ...prevStats,
        totalTokens: Math.round(totalTokensFromLogs),
        totalCost: Number(totalCostFromLogs.toFixed(2))
      }));

      // Check if we have any data at all
      if ((metricsResponse.metrics || []).length === 0 && (logsResponse.logs || []).length === 0) {
        console.warn('No telemetry data available for organization:', organizationId);
      }

    } catch (error) {
      console.error('Error loading analytics data:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      console.error('Error details:', error);
      
      let errorMessage = 'Failed to load analytics data';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Handle SDK-specific errors
        if (error.message === '[object Object]') {
          errorMessage = 'API request failed. Please check your authentication and try again.';
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Handle API error responses
        if ('response' in error && error.response) {
          const apiError = error.response as { data?: { detail?: string; message?: string }; status?: number; statusText?: string };
          if (apiError.data?.detail) {
            errorMessage = apiError.data.detail;
          } else if (apiError.data?.message) {
            errorMessage = apiError.data.message;
          } else if (apiError.statusText) {
            errorMessage = `${apiError.status}: ${apiError.statusText}`;
          }
        } else if ('message' in error) {
          errorMessage = (error as { message: string }).message;
        } else if ('status' in error) {
          const statusError = error as { status: number; statusText?: string };
          errorMessage = `HTTP ${statusError.status}: ${statusError.statusText || 'Request failed'}`;
        } else {
          // Try to extract meaningful information from the error object
          const errorStr = JSON.stringify(error, null, 2);
          if (errorStr !== '{}') {
            errorMessage = `API Error: ${errorStr}`;
          } else {
            errorMessage = 'Unknown API error occurred. Please check your connection and try again.';
          }
        }
      }
      
      setError(errorMessage);
      
      // Reset data on error
      setMetrics([]);
      setLogs([]);
      setStats({
        totalSessions: 0,
        totalCost: 0,
        totalTokens: 0,
        linesOfCode: 0
      });
      setCostData([]);
      setTokenData([]);
      setToolUsageData([]);
      setLogEntries([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, organizationId, docRouterOrgApi, customStartDate, customEndDate]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);



  const getCostDataKeys = (data: TimeSeriesDataPoint[]) => {
    if (data.length === 0) return [];
    
    // Get all unique keys from the data (excluding timestamp)
    const keys = new Set<string>();
    data.forEach(point => {
      Object.keys(point).forEach(key => {
        if (key !== 'timestamp') {
          keys.add(key);
        }
      });
    });

    // Define colors for different language models
    const modelColors = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#06b6d4', '#f59e0b', '#8b5cf6'];
    
    return Array.from(keys)
      .filter(key => enabledLanguageModels[key] !== false) // Only include enabled models
      .map((key, index) => ({
        key,
        label: key,
        color: modelColors[index % modelColors.length],
        lineWidth: 2
      }));
  };

  const getTokenUsageDataKeys = (data: TimeSeriesDataPoint[]) => {
    if (data.length === 0) return [];
    
    // Get all unique keys from the data (excluding timestamp)
    const keys = new Set<string>();
    data.forEach(point => {
      Object.keys(point).forEach(key => {
        if (key !== 'timestamp') {
          keys.add(key);
        }
      });
    });

    // Define colors and labels for different token types
    const tokenTypeConfig: Record<string, { label: string; color: string; lineWidth?: number }> = {
      'input_tokens': { label: 'Input Tokens', color: '#f97316' },
      'output_tokens': { label: 'Output Tokens', color: '#22c55e' },
      'cache_read_tokens': { label: 'Cache Read Tokens', color: '#3b82f6', lineWidth: 3 },
      'cache_creation_tokens': { label: 'Cache Creation Tokens', color: '#a855f7' },
      'total': { label: 'Total Tokens', color: '#ef4444' },
      'prompt': { label: 'Prompt Tokens', color: '#f59e0b' },
      'completion': { label: 'Completion Tokens', color: '#06b6d4' }
    };

    // Default colors for unknown token types
    const defaultColors = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#84cc16'];
    
    return Array.from(keys)
      .filter(key => enabledTokenTypes[key] !== false) // Only include enabled token types
      .map((key, index) => {
        const config = tokenTypeConfig[key];
        if (config) {
          return {
            key,
            label: config.label,
            color: config.color,
            lineWidth: config.lineWidth || 2
          };
        } else {
          // For unknown token types, use default styling
          return {
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1) + ' Tokens',
            color: defaultColors[index % defaultColors.length],
            lineWidth: 2
          };
        }
      });
  };

  const handleTimeRangeChange = (_event: React.MouseEvent<HTMLElement>, newTimeRange: TimeRange | null) => {
    if (newTimeRange !== null) {
      if (newTimeRange === 'custom') {
        // Open modal for custom date range selection
        setIsCustomDateModalOpen(true);
        
        // Initialize custom date range if not set
        if (!customStartDate && !customEndDate) {
          const now = new Date();
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const defaultRange = {
            start: formatDateForInput(yesterday),
            end: formatDateForInput(now)
          };
          setCustomStartDate(defaultRange.start);
          setCustomEndDate(defaultRange.end);
        }
      } else {
        setTimeRange(newTimeRange);
      }
    }
  };

  const handleCustomDateChange = (field: 'start' | 'end', value: string) => {
    if (field === 'start') {
      setCustomStartDate(value);
    } else {
      setCustomEndDate(value);
    }
  };

  const handleApplyCustomDateRange = () => {
    if (customStartDate && customEndDate) {
      setTimeRange('custom');
      setIsCustomDateModalOpen(false);
    }
  };

  const handleCancelCustomDateRange = () => {
    setIsCustomDateModalOpen(false);
  };

  const handleEditCustomDateRange = () => {
    setIsCustomDateModalOpen(true);
  };

  const handleTokenTypeToggle = (tokenType: string) => {
    setEnabledTokenTypes(prev => ({
      ...prev,
      [tokenType]: !prev[tokenType]
    }));
  };

  const handleLanguageModelToggle = (model: string) => {
    setEnabledLanguageModels(prev => ({
      ...prev,
      [model]: !prev[model]
    }));
  };

  if (loading) {
    return (
      <Box className="flex items-center justify-center h-96">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Typography variant="h4" className="font-bold text-gray-900">
              Analytics Dashboard
            </Typography>
            <Typography variant="body2" className="text-gray-600 mt-1">
              Monitor usage, costs, and performance metrics
            </Typography>
          </div>
        </div>

        {/* Error State */}
        <Box className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <Typography variant="h6" className="text-red-800 font-semibold mb-2">
            Error Loading Analytics Data
          </Typography>
          <Typography variant="body2" className="text-red-700 mb-4">
            {error}
          </Typography>
          <Button 
            variant="contained" 
            color="error" 
            onClick={loadAnalyticsData}
            className="bg-red-600 hover:bg-red-700"
          >
            Retry
          </Button>
        </Box>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Typography variant="h4" className="font-bold text-gray-900">
            Analytics Dashboard
          </Typography>
          <Typography variant="body2" className="text-gray-600 mt-1">
            Monitor usage, costs, and performance metrics
          </Typography>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={handleTimeRangeChange}
            size="small"
          >
            <ToggleButton value="1h">1 Hour</ToggleButton>
            <ToggleButton value="6h">6 Hours</ToggleButton>
            <ToggleButton value="24h">24 Hours</ToggleButton>
            <ToggleButton value="7d">7 Days</ToggleButton>
            {timeRange !== 'custom' && (
              <ToggleButton value="custom">
                <DateRangeIcon className="mr-1" />
                Custom
              </ToggleButton>
            )}
          </ToggleButtonGroup>

          <ToggleButtonGroup
            value={displayMode}
            exclusive
            onChange={(_, value) => value && setDisplayMode(value)}
            size="small"
          >
            <ToggleButton value="cumulative">Cumulative</ToggleButton>
            <ToggleButton value="rate">Rate {getTimeInterval(timeRange).label}</ToggleButton>
          </ToggleButtonGroup>
          
          {timeRange === 'custom' && (
            <Paper className="flex items-center gap-3 px-3 py-2 border border-gray-300 bg-white" style={{ height: '32px' }}>
              <ScheduleIcon className="text-gray-600" />
              <div className="flex flex-col justify-center">
                <Typography variant="caption" className="text-gray-600 leading-none">
                  {formatDateRangeForDisplay(customStartDate, customEndDate)}
                </Typography>
              </div>
              <IconButton 
                size="small" 
                onClick={handleEditCustomDateRange}
                className="text-gray-600 hover:bg-gray-100"
                style={{ padding: '4px' }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Paper>
          )}
        </div>
      </div>

      {/* Overview Stats */}
      <div>
        <Typography variant="h6" className="font-semibold mb-3">
          Overview
        </Typography>
        {metrics.length === 0 && logs.length === 0 ? (
          <Box className="p-6 bg-gray-50 rounded-lg text-center">
            <Typography variant="body2" color="textSecondary">
              No telemetry data available for the selected time range. Try selecting a different time range or check if telemetry data is being collected.
            </Typography>
          </Box>
        ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Active Sessions"
              value={stats.totalSessions}
              icon={<TrendingUpIcon />}
              color="blue"
              unit="sessions"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Cost"
              value={`$${stats.totalCost}`}
              icon={<MoneyIcon />}
              color="green"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TokenBreakdownCard
              tokenBreakdown={tokenBreakdown}
              color="purple"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Lines of Code"
              value={stats.linesOfCode}
              icon={<PerformanceIcon />}
              color="orange"
              unit="lines"
            />
          </Grid>
        </Grid>
        )}
      </div>

      {/* Cost & Usage Analysis */}
      <div>
        <Typography variant="h6" className="font-semibold mb-3">
          Cost & Usage Analysis
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {costData.length > 0 ? (
              <TimeSeriesChart
                title={displayMode === 'rate' ? `Cost Rate (${getTimeInterval(timeRange).label})` : "Cost Over Time"}
                data={displayMode === 'rate' ? convertToRateData(costData) : costData}
                dataKeys={getCostDataKeys(displayMode === 'rate' ? convertToRateData(costData) : costData)}
                yAxisLabel={displayMode === 'rate' ? `USD ${getTimeInterval(timeRange).label}` : "USD"}
                showArea={displayMode === 'cumulative'}
              />
            ) : (
              <Box className="p-6 bg-gray-50 rounded-lg text-center">
                <Typography variant="body2" color="textSecondary">
                  No cost data available for the selected time range
                </Typography>
              </Box>
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            {tokenData.length > 0 ? (
              <TimeSeriesChart
                title={displayMode === 'rate' ? `Token Rate (${getTimeInterval(timeRange).label})` : "Token Usage by Type"}
                data={displayMode === 'rate' ? 
                  convertToRateData(filterTokenDataByModels(tokenData, logs)) : 
                  filterTokenDataByModels(tokenData, logs)}
                dataKeys={getTokenUsageDataKeys(displayMode === 'rate' ? 
                  convertToRateData(filterTokenDataByModels(tokenData, logs)) : 
                  filterTokenDataByModels(tokenData, logs))}
                yAxisLabel={displayMode === 'rate' ? `Tokens ${getTimeInterval(timeRange).label}` : "Tokens"}
              />
            ) : (
              <Box className="p-6 bg-gray-50 rounded-lg text-center">
                <Typography variant="body2" color="textSecondary">
                  No token data available for the selected time range
                </Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      </div>

      {/* Tool Usage Analysis */}
      <div>
        <Typography variant="h6" className="font-semibold mb-3">
          Tool Usage Analysis
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            {toolUsageData.length > 0 ? (
              <BarChart
                title="Tool Usage Count"
                data={toolUsageData}
                dataKey="value"
                xAxisLabel="Tools"
                yAxisLabel="Usage Count"
                height={400}
              />
            ) : (
              <Box className="p-6 bg-gray-50 rounded-lg text-center">
                <Typography variant="body2" color="textSecondary">
                  No tool usage data available for the selected time range
                </Typography>
              </Box>
            )}
          </Grid>
          <Grid item xs={12} md={4}>
            <Box className="p-6 bg-white rounded-lg shadow-sm border">
              <Typography variant="h6" className="font-semibold mb-4">
                Average Duration
              </Typography>
              {Object.keys(toolAverageDuration).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(toolAverageDuration)
                    .sort(([, a], [, b]) => b - a) // Sort by duration descending
                    .map(([toolName, avgDuration]) => (
                      <div key={toolName} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <Typography variant="body2" className="font-medium text-gray-900">
                            {toolName.replace('mcp__docrouter__', '')}
                          </Typography>
                        </div>
                        <Typography variant="body2" className="text-gray-600">
                          {avgDuration}ms
                        </Typography>
                      </div>
                    ))}
                </div>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No duration data available
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </div>

      {/* Global Controls */}
      <div>
        <Typography variant="h6" className="font-semibold mb-3">
          Chart Controls
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {/* Token Type Selection */}
            <Box className="p-4 bg-gray-50 rounded-lg">
              <Typography variant="subtitle2" className="font-medium text-gray-700 mb-3">
                Token Types:
              </Typography>
              <FormGroup row>
                {Object.entries({
                  input_tokens: 'Input Tokens',
                  output_tokens: 'Output Tokens',
                  cache_read_tokens: 'Cache Read Tokens',
                  cache_creation_tokens: 'Cache Creation Tokens'
                }).map(([key, label]) => (
                  <FormControlLabel
                    key={key}
                    control={
                      <Checkbox
                        checked={enabledTokenTypes[key] !== false}
                        onChange={() => handleTokenTypeToggle(key)}
                        size="small"
                        sx={{
                          color: key === 'input_tokens' ? '#f97316' :
                                 key === 'output_tokens' ? '#22c55e' :
                                 key === 'cache_read_tokens' ? '#3b82f6' :
                                 key === 'cache_creation_tokens' ? '#a855f7' : '#666',
                          '&.Mui-checked': {
                            color: key === 'input_tokens' ? '#f97316' :
                                   key === 'output_tokens' ? '#22c55e' :
                                   key === 'cache_read_tokens' ? '#3b82f6' :
                                   key === 'cache_creation_tokens' ? '#a855f7' : '#666',
                          }
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2" className="text-sm">
                        {label}
                      </Typography>
                    }
                  />
                ))}
              </FormGroup>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            {/* Language Model Selection */}
            {Object.keys(enabledLanguageModels).length > 0 && (
              <Box className="p-4 bg-gray-50 rounded-lg">
                <Typography variant="subtitle2" className="font-medium text-gray-700 mb-3">
                  Language Models:
                </Typography>
                <FormGroup row>
                  {Object.entries(enabledLanguageModels).map(([model, enabled]) => (
                    <FormControlLabel
                      key={model}
                      control={
                        <Checkbox
                          checked={enabled}
                          onChange={() => handleLanguageModelToggle(model)}
                          size="small"
                          sx={{
                            color: '#22c55e',
                            '&.Mui-checked': {
                              color: '#22c55e',
                            }
                          }}
                        />
                      }
                      label={
                        <Typography variant="body2" className="text-sm">
                          {model}
                        </Typography>
                      }
                    />
                  ))}
                </FormGroup>
              </Box>
            )}
          </Grid>
        </Grid>
      </div>


      {/* Event Logs */}
      <div>
        <Typography variant="h6" className="font-semibold mb-3">
          Event Logs
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <LogViewer
              title="Recent Events"
              logs={logEntries}
              maxHeight={400}
            />
          </Grid>
        </Grid>
      </div>

      {/* Custom Date Range Modal */}
      <Dialog 
        open={isCustomDateModalOpen} 
        onClose={handleCancelCustomDateRange}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DateRangeIcon className="text-blue-600" />
            <Typography variant="h6" className="font-semibold">
              Custom Date Range
            </Typography>
          </div>
          <IconButton 
            onClick={handleCancelCustomDateRange}
            size="small"
            className="text-gray-500 hover:text-gray-700"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent className="pt-4">
          <div className="space-y-4">
            <Typography variant="body2" className="text-gray-600 mb-4">
              Select the start and end date/time for your custom range. Times are in your local timezone.
            </Typography>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                label="Start Date & Time"
                type="datetime-local"
                value={customStartDate}
                onChange={(e) => handleCustomDateChange('start', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Beginning of the range"
              />
              <TextField
                label="End Date & Time"
                type="datetime-local"
                value={customEndDate}
                onChange={(e) => handleCustomDateChange('end', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="End of the range"
              />
            </div>
            
            {customStartDate && customEndDate && (
              <Paper className="p-3 bg-gray-50 border border-gray-200">
                <Typography variant="body2" className="text-gray-700 font-medium mb-1">
                  Selected Range:
                </Typography>
                <Typography variant="body2" className="text-gray-600">
                  {formatDateRangeForDisplay(customStartDate, customEndDate)}
                </Typography>
              </Paper>
            )}
          </div>
        </DialogContent>
        
        <DialogActions className="p-4 pt-2">
          <Button 
            onClick={handleCancelCustomDateRange}
            variant="outlined"
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleApplyCustomDateRange}
            variant="contained"
            color="primary"
            disabled={!customStartDate || !customEndDate}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Apply Range
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default TelemetryAnalyticsDashboard;
