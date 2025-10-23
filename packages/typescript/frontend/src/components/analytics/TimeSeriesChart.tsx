'use client'

import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, Typography, IconButton, Box } from '@mui/material';
import { ZoomIn, ZoomOut, RestartAlt } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceArea } from 'recharts';

export interface TimeSeriesDataPoint {
  timestamp: string | number;
  [key: string]: string | number;
}

export interface TimeSeriesChartProps {
  title: string;
  data: TimeSeriesDataPoint[];
  dataKeys: Array<{
    key: string;
    label: string;
    color: string;
    lineWidth?: number;
  }>;
  height?: number;
  yAxisLabel?: string;
  xAxisLabel?: string;
  showArea?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  yAxisFormat?: 'number' | 'currency';
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  title,
  data,
  dataKeys,
  height = 300,
  yAxisLabel,
  xAxisLabel,
  showArea = false,
  showLegend = true,
  showGrid = true,
  yAxisFormat = 'number'
}) => {
  // Keep timestamps as numbers for proper time-based spacing
  const formattedData = useMemo(() => {
    return data.map(point => ({
      ...point,
      // Keep timestamp as number (milliseconds) for numeric X-axis
      timestampMs: typeof point.timestamp === 'number' ? point.timestamp : new Date(point.timestamp).getTime()
    }));
  }, [data]);

  // Calculate initial domain from data
  const initialDomain = useMemo(() => {
    if (formattedData.length === 0) return { min: 0, max: 0 };
    const timestamps = formattedData.map(d => d.timestampMs);
    return { min: Math.min(...timestamps), max: Math.max(...timestamps) };
  }, [formattedData]);

  // Zoom state
  const [zoomDomain, setZoomDomain] = useState<{ min: number; max: number } | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);

  // Format timestamp for display on axis
  const formatXAxis = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format Y-axis numbers with abbreviations (K, M, B)
  const formatYAxis = (value: number) => {
    if (value === 0) return yAxisFormat === 'currency' ? '$0' : '0';

    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    const prefix = yAxisFormat === 'currency' ? '$' : '';

    if (absValue >= 1_000_000_000) {
      return prefix + sign + (absValue / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (absValue >= 1_000_000) {
      return prefix + sign + (absValue / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (absValue >= 1_000) {
      return prefix + sign + (absValue / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    if (yAxisFormat === 'currency') {
      return prefix + sign + absValue.toFixed(2);
    }
    return sign + absValue.toFixed(0);
  };

  // Zoom in handler
  const handleZoomIn = useCallback(() => {
    const currentDomain = zoomDomain || initialDomain;
    const range = currentDomain.max - currentDomain.min;
    const center = currentDomain.min + range / 2;
    const newRange = range * 0.6; // Zoom in by 40%

    setZoomDomain({
      min: center - newRange / 2,
      max: center + newRange / 2
    });
  }, [zoomDomain, initialDomain]);

  // Zoom out handler
  const handleZoomOut = useCallback(() => {
    const currentDomain = zoomDomain || initialDomain;
    const range = currentDomain.max - currentDomain.min;
    const center = currentDomain.min + range / 2;
    const newRange = range * 1.4; // Zoom out by 40%

    const newMin = center - newRange / 2;
    const newMax = center + newRange / 2;

    // Don't zoom out beyond the initial domain
    if (newMin <= initialDomain.min && newMax >= initialDomain.max) {
      setZoomDomain(null);
    } else {
      setZoomDomain({
        min: Math.max(newMin, initialDomain.min),
        max: Math.min(newMax, initialDomain.max)
      });
    }
  }, [zoomDomain, initialDomain]);

  // Reset zoom handler
  const handleResetZoom = useCallback(() => {
    setZoomDomain(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, []);

  // Handle mouse down for selection zoom
  const handleMouseDown = useCallback((e: { activeLabel?: string | number }) => {
    if (e && e.activeLabel) {
      const timestamp = typeof e.activeLabel === 'string' ? parseFloat(e.activeLabel) : e.activeLabel;
      setRefAreaLeft(timestamp);
    }
  }, []);

  // Handle mouse move for selection zoom
  const handleMouseMove = useCallback((e: { activeLabel?: string | number }) => {
    if (refAreaLeft && e && e.activeLabel) {
      const timestamp = typeof e.activeLabel === 'string' ? parseFloat(e.activeLabel) : e.activeLabel;
      setRefAreaRight(timestamp);
    }
  }, [refAreaLeft]);

  // Handle mouse up to apply selection zoom
  const handleMouseUp = useCallback(() => {
    if (refAreaLeft && refAreaRight) {
      const left = Math.min(refAreaLeft, refAreaRight);
      const right = Math.max(refAreaLeft, refAreaRight);

      // Only zoom if selection is significant (more than 1% of range)
      const currentDomain = zoomDomain || initialDomain;
      const range = currentDomain.max - currentDomain.min;
      if (right - left > range * 0.01) {
        setZoomDomain({ min: left, max: right });
      }
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, zoomDomain, initialDomain]);

  const currentDomain = zoomDomain || initialDomain;
  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <Card>
      <CardContent>
        <Box className="flex items-center justify-between mb-4">
          <Typography variant="h6" className="font-semibold">
            {title}
          </Typography>
          <Box className="flex gap-1">
            <IconButton
              size="small"
              onClick={handleZoomIn}
              title="Zoom In"
              className="hover:bg-gray-100"
            >
              <ZoomIn fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleZoomOut}
              title="Zoom Out"
              className="hover:bg-gray-100"
            >
              <ZoomOut fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleResetZoom}
              title="Reset Zoom"
              className="hover:bg-gray-100"
            >
              <RestartAlt fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Typography variant="caption" className="text-gray-600 mb-2 block">
          Click and drag on the chart to zoom into a specific time range
        </Typography>
        <ResponsiveContainer width="100%" height={height}>
          <ChartComponent
            data={formattedData}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
            <XAxis
              dataKey="timestampMs"
              type="number"
              domain={[currentDomain.min, currentDomain.max]}
              scale="time"
              tickFormatter={formatXAxis}
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
              tick={{ fontSize: 12 }}
              allowDataOverflow
            />
            <YAxis
              tickFormatter={formatYAxis}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
              tick={{ fontSize: 12 }}
              width={60}
            />
            <Tooltip
              labelFormatter={formatXAxis}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            {showLegend && <Legend />}
            {dataKeys.map((item) =>
              showArea ? (
                <Area
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={item.color}
                  fill={item.color}
                  fillOpacity={0.3}
                  strokeWidth={item.lineWidth || 2}
                />
              ) : (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={item.color}
                  strokeWidth={item.lineWidth || 2}
                  dot={false}
                />
              )
            )}
            {refAreaLeft && refAreaRight && (
              <ReferenceArea
                x1={refAreaLeft}
                x2={refAreaRight}
                strokeOpacity={0.3}
                fill="#8884d8"
                fillOpacity={0.3}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default TimeSeriesChart;
