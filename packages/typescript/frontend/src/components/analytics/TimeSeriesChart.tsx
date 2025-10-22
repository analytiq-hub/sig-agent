'use client'

import React, { useMemo } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

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
  showGrid = true
}) => {
  const formattedData = useMemo(() => {
    return data.map(point => ({
      ...point,
      timestamp: typeof point.timestamp === 'number'
        ? new Date(point.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : point.timestamp
    }));
  }, [data]);

  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" className="font-semibold mb-4">
          {title}
        </Typography>
        <ResponsiveContainer width="100%" height={height}>
          <ChartComponent data={formattedData}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
            <XAxis
              dataKey="timestamp"
              label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
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
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default TimeSeriesChart;
