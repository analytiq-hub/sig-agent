'use client'

import React from 'react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export interface BarChartDataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

export interface BarChartProps {
  title: string;
  data: BarChartDataPoint[];
  dataKey: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  color?: string;
  height?: number;
  horizontal?: boolean;
  maxLabelLength?: number;
}

const BarChart: React.FC<BarChartProps> = ({
  title,
  data,
  dataKey,
  yAxisLabel,
  height = 300,
  maxLabelLength = 36
}) => {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#ec4899', // pink
    '#6b7280'  // gray
  ];

  // Format x-axis labels with truncation
  const formatXAxisLabel = (label: string) => {
    return label.length > maxLabelLength ? label.substring(0, maxLabelLength) + '...' : label;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
              tickFormatter={formatXAxisLabel}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
            />
            <Tooltip 
              formatter={(value: number) => [value, dataKey]}
              labelFormatter={(label: string) => `Tool: ${label}`}
            />
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={60}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color ? String(entry.color) : colors[index % colors.length]} 
                />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default BarChart;
