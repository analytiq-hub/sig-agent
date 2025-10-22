'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DocRouterOrgApi } from '@/utils/api';
import { Box, Typography, Grid, ToggleButton, ToggleButtonGroup, CircularProgress, Button, TextField, Paper, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
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
    const tokenMetrics = filteredMetrics.filter(m => 
      m.name && (m.name.toLowerCase().includes('token') || m.name.toLowerCase().includes('llm'))
    );
    const locMetrics = filteredMetrics.filter(m => 
      m.name && (m.name.toLowerCase().includes('code') || m.name.toLowerCase().includes('line'))
    );

    // Calculate totals
    let totalSessions = 0;
    let totalCost = 0;
    let totalTokens = 0;
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

    tokenMetrics.forEach(metric => {
      if (metric.data_points && Array.isArray(metric.data_points)) {
        metric.data_points.forEach((dp: DataPoint) => {
          const timestamp = parseInt(dp.timeUnixNano) / 1000000;
          const dataPointTime = new Date(timestamp);
          
          // Only include data points within the time range
          const isAfterStart = dataPointTime >= startTime;
          const isBeforeEnd = endTime ? dataPointTime <= endTime : true;
          if (isAfterStart && isBeforeEnd) {
            const value = dp.value?.asDouble || dp.value?.asInt || 0;
            totalTokens += typeof value === 'string' ? parseFloat(value) : value;
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
      totalTokens: Math.round(totalTokens),
      linesOfCode: Math.round(linesOfCode)
    });

    // Process time series data for charts
    const costTimeSeries: TimeSeriesDataPoint[] = [];
    const tokenTimeSeries: TimeSeriesDataPoint[] = [];

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

    tokenMetrics.forEach(metric => {
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

            // Get the type from resource attributes if available
            let type = 'total';
            if (metric.resource?.attributes && Array.isArray(metric.resource.attributes)) {
              const typeAttr = metric.resource.attributes.find((attr: ResourceAttribute) => attr.key === 'type');
              if (typeAttr?.value?.stringValue) {
                type = typeAttr.value.stringValue;
              }
            }

            const existing = tokenTimeSeries.find(t => t.timestamp === timestamp);
            if (existing) {
              existing[type] = numValue;
            } else {
              tokenTimeSeries.push({
                timestamp,
                [type]: numValue
              });
            }
          }
        });
      }
    });

    setCostData(costTimeSeries.sort((a, b) => Number(a.timestamp) - Number(b.timestamp)));
    setTokenData(tokenTimeSeries.sort((a, b) => Number(a.timestamp) - Number(b.timestamp)));

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
            <ToggleButton value="custom">
              <DateRangeIcon className="mr-1" />
              Custom
            </ToggleButton>
          </ToggleButtonGroup>
          
          {timeRange === 'custom' && (
            <Paper className="p-3 bg-blue-50 border border-blue-200 flex items-center gap-3">
              <ScheduleIcon className="text-blue-600" />
              <div className="flex flex-col">
                <Typography variant="body2" className="text-blue-800 font-medium">
                  Custom Range
                </Typography>
                <Typography variant="caption" className="text-blue-600">
                  {formatDateRangeForDisplay(customStartDate, customEndDate)}
                </Typography>
              </div>
              <IconButton 
                size="small" 
                onClick={handleEditCustomDateRange}
                className="text-blue-600 hover:bg-blue-100"
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
              <TimeSeriesChart
                title="Token Usage by Type"
                data={tokenData}
                dataKeys={[
                  { key: 'input', label: 'Input', color: '#f97316' },
                  { key: 'output', label: 'Output', color: '#22c55e' },
                  { key: 'cacheRead', label: 'Cache Read', color: '#3b82f6', lineWidth: 3 },
                  { key: 'cacheCreation', label: 'Cache Creation', color: '#a855f7' }
                ]}
                yAxisLabel="Tokens"
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
