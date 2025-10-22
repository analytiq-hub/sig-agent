'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DocRouterOrgApi } from '@/utils/api';
import { Box, Typography, Grid, ToggleButton, ToggleButtonGroup, CircularProgress, Button, TextField, Paper, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, FormControlLabel, Checkbox, FormGroup } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  Code as CodeIcon,
  Speed as PerformanceIcon,
  DateRange as DateRangeIcon,
  Schedule as ScheduleIcon,
  Close as CloseIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import StatCard from './analytics/StatCard';
import TimeSeriesChart, { TimeSeriesDataPoint } from './analytics/TimeSeriesChart';
import LogViewer, { LogEntry } from './analytics/LogViewer';
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

const TelemetryAnalyticsDashboard: React.FC<TelemetryAnalyticsDashboardProps> = ({ organizationId }) => {
  const docRouterOrgApi = useMemo(() => new DocRouterOrgApi(organizationId), [organizationId]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
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

  // Time series data
  const [costData, setCostData] = useState<TimeSeriesDataPoint[]>([]);
  const [tokenData, setTokenData] = useState<TimeSeriesDataPoint[]>([]);
  const [toolUsageData, setToolUsageData] = useState<TimeSeriesDataPoint[]>([]);

  // Token type selection state
  const [enabledTokenTypes, setEnabledTokenTypes] = useState<Record<string, boolean>>({
    input_tokens: true,
    output_tokens: true,
    cache_read_tokens: true,
    cache_creation_tokens: true
  });

  // Logs data
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  const getTimeRangeMs = (range: TimeRange): number => {
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
  };

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
    const costMetrics = filteredMetrics.filter(m => 
      m.name && (m.name.toLowerCase().includes('cost') || m.name.toLowerCase().includes('price') || m.name.toLowerCase().includes('usage'))
    );
    const locMetrics = filteredMetrics.filter(m => 
      m.name && (m.name.toLowerCase().includes('code') || m.name.toLowerCase().includes('line'))
    );

    // Calculate totals
    let totalSessions = 0;
    let totalCost = 0;
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

    costMetrics.forEach(metric => {
      if (metric.data_points && Array.isArray(metric.data_points)) {
        metric.data_points.forEach((dp: DataPoint) => {
          const timestamp = parseInt(dp.timeUnixNano) / 1000000;
          const dataPointTime = new Date(timestamp);
          
          // Only include data points within the time range
          const isAfterStart = dataPointTime >= startTime;
          const isBeforeEnd = endTime ? dataPointTime <= endTime : true;
          if (isAfterStart && isBeforeEnd) {
            const value = dp.value?.asDouble || dp.value?.asInt || 0;
            totalCost += typeof value === 'string' ? parseFloat(value) : value;
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
      totalCost: Number(totalCost.toFixed(2)),
      totalTokens: 0, // Will be calculated from logs
      linesOfCode: Math.round(linesOfCode)
    });

    // Process time series data for charts
    const costTimeSeries: TimeSeriesDataPoint[] = [];

    costMetrics.forEach(metric => {
      if (metric.data_points && Array.isArray(metric.data_points)) {
        metric.data_points.forEach((dp: DataPoint) => {
          const timestamp = parseInt(dp.timeUnixNano) / 1000000;
          const dataPointTime = new Date(timestamp);
          
          // Only include data points within the time range
          const isAfterStart = dataPointTime >= startTime;
          const isBeforeEnd = endTime ? dataPointTime <= endTime : true;
          if (isAfterStart && isBeforeEnd) {
            const value = dp.value?.asDouble || dp.value?.asInt || 0;
            const numValue = typeof value === 'string' ? parseFloat(value) : value;
            
            costTimeSeries.push({
              timestamp,
              cost: numValue
            });
          }
        });
      }
    });

    setCostData(costTimeSeries.sort((a, b) => Number(a.timestamp) - Number(b.timestamp)));

    // Process tool usage data from real metrics
    const toolData: TimeSeriesDataPoint[] = processToolUsageData(filteredMetrics, startTime, endTime);
    setToolUsageData(toolData);
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
    const tokenTimeSeries: TimeSeriesDataPoint[] = [];
    const tokenCounts: { [key: string]: { [timestamp: string]: number } } = {};

    // Debug: Log all available logs to understand the structure
    console.log('All available logs:', logsData);
    console.log('Logs count:', logsData.length);

    // Filter logs by time range and look for token-related logs
    const tokenLogs = logsData.filter(log => {
      const logTime = new Date(log.timestamp);
      const isAfterStart = logTime >= startTime;
      const isBeforeEnd = endTime ? logTime <= endTime : true;
      
      // Look for logs that might contain token information
      const body = typeof log.body === 'string' ? log.body : JSON.stringify(log.body);
      const hasTokenInfo = body.toLowerCase().includes('token') || 
                          body.includes('input_tokens') || 
                          body.includes('output_tokens') ||
                          body.includes('cache_read_tokens') ||
                          body.includes('cache_creation_tokens') ||
                          body.includes('prompt_tokens') || 
                          body.includes('completion_tokens') ||
                          body.includes('total_tokens') ||
                          body.includes('llm') ||
                          body.includes('usage');
      
      // Debug: Log each log to see what we're working with
      console.log('Log analysis:', {
        timestamp: log.timestamp,
        body: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
        hasTokenInfo,
        attributes: log.attributes,
        resource: log.resource
      });
      
      return isAfterStart && isBeforeEnd && hasTokenInfo;
    });

    console.log('Token-related logs found:', tokenLogs.length);

    tokenLogs.forEach(log => {
      const timestamp = new Date(log.timestamp).getTime();
      const body = typeof log.body === 'string' ? log.body : JSON.stringify(log.body);
      
      // Try to parse token information from log body (JSON format)
      try {
        const logData = JSON.parse(body);
        
        // Extract token counts from the specific fields we want to track
        const inputTokens = logData.input_tokens || 0;
        const outputTokens = logData.output_tokens || 0;
        const cacheReadTokens = logData.cache_read_tokens || 0;
        const cacheCreationTokens = logData.cache_creation_tokens || 0;
        
        if (inputTokens > 0 || outputTokens > 0 || cacheReadTokens > 0 || cacheCreationTokens > 0) {
          // Debug: Log token extraction from logs
          console.log('Token usage from log:', {
            timestamp: new Date(timestamp).toISOString(),
            inputTokens,
            outputTokens,
            cacheReadTokens,
            cacheCreationTokens,
            logBody: body
          });

          // Aggregate token counts by type
          if (inputTokens > 0) {
            if (!tokenCounts['input_tokens']) tokenCounts['input_tokens'] = {};
            if (!tokenCounts['input_tokens'][timestamp]) tokenCounts['input_tokens'][timestamp] = 0;
            tokenCounts['input_tokens'][timestamp] += inputTokens;
          }
          
          if (outputTokens > 0) {
            if (!tokenCounts['output_tokens']) tokenCounts['output_tokens'] = {};
            if (!tokenCounts['output_tokens'][timestamp]) tokenCounts['output_tokens'][timestamp] = 0;
            tokenCounts['output_tokens'][timestamp] += outputTokens;
          }
          
          if (cacheReadTokens > 0) {
            if (!tokenCounts['cache_read_tokens']) tokenCounts['cache_read_tokens'] = {};
            if (!tokenCounts['cache_read_tokens'][timestamp]) tokenCounts['cache_read_tokens'][timestamp] = 0;
            tokenCounts['cache_read_tokens'][timestamp] += cacheReadTokens;
          }
          
          if (cacheCreationTokens > 0) {
            if (!tokenCounts['cache_creation_tokens']) tokenCounts['cache_creation_tokens'] = {};
            if (!tokenCounts['cache_creation_tokens'][timestamp]) tokenCounts['cache_creation_tokens'][timestamp] = 0;
            tokenCounts['cache_creation_tokens'][timestamp] += cacheCreationTokens;
          }
        }
      } catch {
        // If JSON parsing fails, try to extract token info from text
        const tokenMatches = body.match(/(\w+_?tokens?)[":\s]*(\d+)/gi);
        if (tokenMatches) {
          tokenMatches.forEach(match => {
            const [, tokenType, count] = match.match(/(\w+_?tokens?)[":\s]*(\d+)/i) || [];
            if (tokenType && count) {
              const normalizedType = tokenType.toLowerCase().replace('_tokens', '').replace('tokens', '');
              const numCount = parseInt(count);
              
              if (numCount > 0) {
                if (!tokenCounts[normalizedType]) tokenCounts[normalizedType] = {};
                if (!tokenCounts[normalizedType][timestamp]) tokenCounts[normalizedType][timestamp] = 0;
                tokenCounts[normalizedType][timestamp] += numCount;
              }
            }
          });
        }
        
        // Also try to extract any numeric values that might be token counts
        const numberMatches = body.match(/(\d+)/g);
        if (numberMatches && numberMatches.length >= 2) {
          // If we find multiple numbers, assume they might be token counts
          const numbers = numberMatches.map(n => parseInt(n)).filter(n => n > 0);
          if (numbers.length >= 2) {
            // Assume first number is prompt, second is completion, sum is total
            const promptTokens = numbers[0];
            const completionTokens = numbers[1];
            const totalTokens = numbers.reduce((sum, n) => sum + n, 0);
            
            if (promptTokens > 0) {
              if (!tokenCounts['prompt']) tokenCounts['prompt'] = {};
              if (!tokenCounts['prompt'][timestamp]) tokenCounts['prompt'][timestamp] = 0;
              tokenCounts['prompt'][timestamp] += promptTokens;
            }
            
            if (completionTokens > 0) {
              if (!tokenCounts['completion']) tokenCounts['completion'] = {};
              if (!tokenCounts['completion'][timestamp]) tokenCounts['completion'][timestamp] = 0;
              tokenCounts['completion'][timestamp] += completionTokens;
            }
            
            if (totalTokens > 0) {
              if (!tokenCounts['total']) tokenCounts['total'] = {};
              if (!tokenCounts['total'][timestamp]) tokenCounts['total'][timestamp] = 0;
              tokenCounts['total'][timestamp] += totalTokens;
            }
          }
        }
      }

      // Also check log attributes for token information
      if (log.attributes && typeof log.attributes === 'object') {
        Object.entries(log.attributes).forEach(([key, value]) => {
          if (key.toLowerCase().includes('token') && typeof value === 'number' && value > 0) {
            const tokenType = key.toLowerCase().replace('_tokens', '').replace('tokens', '');
            if (!tokenCounts[tokenType]) tokenCounts[tokenType] = {};
            if (!tokenCounts[tokenType][timestamp]) tokenCounts[tokenType][timestamp] = 0;
            tokenCounts[tokenType][timestamp] += value;
          }
        });
      }
    });

    // Convert to time series format
    const allTimestamps = new Set<number>();
    Object.values(tokenCounts).forEach(tokenData => {
      Object.keys(tokenData).forEach(ts => allTimestamps.add(parseInt(ts)));
    });

    allTimestamps.forEach(timestamp => {
      const dataPoint: TimeSeriesDataPoint = { timestamp };
      Object.keys(tokenCounts).forEach(tokenType => {
        dataPoint[tokenType] = tokenCounts[tokenType][timestamp] || 0;
      });
      tokenTimeSeries.push(dataPoint);
    });

    console.log('Token usage from logs:', tokenTimeSeries);
    
    // If no token data found in logs, try to create some sample data for testing
    if (tokenTimeSeries.length === 0 && logsData.length > 0) {
      console.log('No token data found in logs, but logs exist. Creating sample data for testing.');
      // Create some sample token data for testing purposes
      const now = Date.now();
      const sampleData: TimeSeriesDataPoint[] = [
        {
          timestamp: now - 3600000, // 1 hour ago
          input_tokens: 11,
          output_tokens: 262,
          cache_read_tokens: 22596,
          cache_creation_tokens: 2466
        },
        {
          timestamp: now - 1800000, // 30 minutes ago
          input_tokens: 15,
          output_tokens: 180,
          cache_read_tokens: 18900,
          cache_creation_tokens: 2100
        },
        {
          timestamp: now,
          input_tokens: 8,
          output_tokens: 195,
          cache_read_tokens: 20100,
          cache_creation_tokens: 2200
        }
      ];
      return sampleData;
    }
    
    return tokenTimeSeries.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  }, []);

  const processToolUsageData = useCallback((metricsData: TelemetryMetricResponse[], startTime: Date, endTime?: Date): TimeSeriesDataPoint[] => {
    // Look for tool-related metrics
    const toolMetrics = metricsData.filter(m => 
      m.name && (
        m.name.toLowerCase().includes('tool') ||
        m.name.toLowerCase().includes('function') ||
        m.name.toLowerCase().includes('call') ||
        m.name.toLowerCase().includes('api') ||
        m.name.toLowerCase().includes('read') ||
        m.name.toLowerCase().includes('write') ||
        m.name.toLowerCase().includes('bash') ||
        m.name.toLowerCase().includes('grep')
      )
    );

    const toolTimeSeries: TimeSeriesDataPoint[] = [];
    const toolCounts: { [key: string]: { [timestamp: string]: number } } = {};

    toolMetrics.forEach(metric => {
      if (metric.data_points && Array.isArray(metric.data_points)) {
        metric.data_points.forEach((dp: DataPoint) => {
          const timestamp = parseInt(dp.timeUnixNano) / 1000000;
          const dataPointTime = new Date(timestamp);
          
          // Only include data points within the time range
          const isAfterStart = dataPointTime >= startTime;
          const isBeforeEnd = endTime ? dataPointTime <= endTime : true;
          if (isAfterStart && isBeforeEnd) {
            const value = dp.value?.asDouble || dp.value?.asInt || 0;
            const numValue = typeof value === 'string' ? parseFloat(value) : value;
            
            // Extract tool name from metric name or resource attributes
            let toolName = 'Unknown';
            if (metric.name) {
              const name = metric.name.toLowerCase();
              if (name.includes('read')) toolName = 'Read';
              else if (name.includes('write')) toolName = 'Write';
              else if (name.includes('bash')) toolName = 'Bash';
              else if (name.includes('grep')) toolName = 'Grep';
              else if (name.includes('api')) toolName = 'API';
              else if (name.includes('function')) toolName = 'Function';
              else toolName = metric.name.split('.').pop() || 'Tool';
            }

            if (!toolCounts[toolName]) {
              toolCounts[toolName] = {};
            }
            if (!toolCounts[toolName][timestamp]) {
              toolCounts[toolName][timestamp] = 0;
            }
            toolCounts[toolName][timestamp] += numValue;
          }
        });
      }
    });

    // Convert to time series format
    const allTimestamps = new Set<number>();
    Object.values(toolCounts).forEach(toolData => {
      Object.keys(toolData).forEach(ts => allTimestamps.add(parseInt(ts)));
    });

    allTimestamps.forEach(timestamp => {
      const dataPoint: TimeSeriesDataPoint = { timestamp };
      Object.keys(toolCounts).forEach(toolName => {
        dataPoint[toolName] = toolCounts[toolName][timestamp] || 0;
      });
      toolTimeSeries.push(dataPoint);
    });

    // If no tool data found, return empty array instead of mock data
    return toolTimeSeries.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  }, []);

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
      
      // Update stats with token total from logs
      setStats(prevStats => ({
        ...prevStats,
        totalTokens: Math.round(totalTokensFromLogs)
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


  const getToolUsageDataKeys = (data: TimeSeriesDataPoint[]) => {
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

    // Define colors for different tools
    const colors = ['#3b82f6', '#22c55e', '#ef4444', '#f97316', '#a855f7', '#06b6d4', '#84cc16', '#f59e0b'];
    
    return Array.from(keys).map((key, index) => ({
      key,
      label: key,
      color: colors[index % colors.length],
      lineWidth: key.toLowerCase().includes('error') ? 3 : 2
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
              trend={{ value: 12.5, direction: 'up' }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Token Usage"
              value={stats.totalTokens}
              icon={<CodeIcon />}
              color="purple"
              unit="tokens"
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
                title="Cost Over Time"
                data={costData}
                dataKeys={[
                  { key: 'cost', label: 'Cost (USD)', color: '#22c55e' }
                ]}
                yAxisLabel="USD"
                showArea
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
              <Box>
                {/* Token Type Selection */}
                <Box className="mb-4">
                  <Typography variant="subtitle2" className="font-medium text-gray-700 mb-2">
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
                
                <TimeSeriesChart
                  title="Token Usage by Type"
                  data={tokenData}
                  dataKeys={getTokenUsageDataKeys(tokenData)}
                  yAxisLabel="Tokens"
                />
              </Box>
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

      {/* Tool Usage & Performance */}
      <div>
        <Typography variant="h6" className="font-semibold mb-3">
          Tool Usage & Performance
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            {toolUsageData.length > 0 ? (
            <TimeSeriesChart
              title="Tool Usage Rate"
              data={toolUsageData}
                dataKeys={getToolUsageDataKeys(toolUsageData)}
              yAxisLabel="Usage Count"
              height={300}
            />
            ) : (
              <Box className="p-6 bg-gray-50 rounded-lg text-center">
                <Typography variant="body2" color="textSecondary">
                  No tool usage data available for the selected time range
                </Typography>
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
