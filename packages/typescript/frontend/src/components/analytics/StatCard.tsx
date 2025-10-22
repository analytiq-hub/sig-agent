'use client'

import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

export interface StatCardProps {
  title: string;
  value: number | string;
  unit?: string;
  icon?: React.ReactNode;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange';
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  sparklineData?: number[];
}

const colorMap = {
  green: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    text: 'text-green-700',
    icon: 'text-green-600'
  },
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-500',
    text: 'text-yellow-700',
    icon: 'text-yellow-600'
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-700',
    icon: 'text-red-600'
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    text: 'text-blue-700',
    icon: 'text-blue-600'
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-500',
    text: 'text-purple-700',
    icon: 'text-purple-600'
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-500',
    text: 'text-orange-700',
    icon: 'text-orange-600'
  }
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  icon,
  color = 'blue',
  trend,
  sparklineData
}) => {
  const colors = colorMap[color];

  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length === 0) return null;

    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min || 1;

    const points = sparklineData.map((val, idx) => {
      const x = (idx / (sparklineData.length - 1)) * 100;
      const y = 30 - ((val - min) / range) * 30;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg className="w-full h-8 mt-2" viewBox="0 0 100 30" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
          className={colors.icon}
          opacity="0.6"
        />
      </svg>
    );
  };

  return (
    <Card className={`${colors.bg} border-l-4 ${colors.border}`}>
      <CardContent>
        <div className="flex items-start justify-between mb-2">
          <Typography variant="subtitle2" className="text-gray-600 font-medium">
            {title}
          </Typography>
          {icon && (
            <div className={colors.icon}>
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <Typography variant="h4" className={`font-bold ${colors.text}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>
          {unit && (
            <Typography variant="body2" className="text-gray-500">
              {unit}
            </Typography>
          )}
        </div>

        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.direction === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <Typography variant="caption" className={trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}>
              {trend.value}%
            </Typography>
            <Typography variant="caption" className="text-gray-500 ml-1">
              vs last period
            </Typography>
          </div>
        )}

        {renderSparkline()}
      </CardContent>
    </Card>
  );
};

export default StatCard;
