'use client'

import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

export interface TokenBreakdownCardProps {
  title: string;
  tokenBreakdown: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
  };
  icon?: React.ReactNode;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange';
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

const TokenBreakdownCard: React.FC<TokenBreakdownCardProps> = ({
  title,
  tokenBreakdown,
  icon,
  color = 'purple'
}) => {
  const colors = colorMap[color];
  const totalTokens = tokenBreakdown.input_tokens + tokenBreakdown.output_tokens + 
                     tokenBreakdown.cache_read_tokens + tokenBreakdown.cache_creation_tokens;

  const tokenTypes = [
    { key: 'input_tokens', label: 'Input', value: tokenBreakdown.input_tokens, color: '#f97316' },
    { key: 'output_tokens', label: 'Output', value: tokenBreakdown.output_tokens, color: '#22c55e' },
    { key: 'cache_read_tokens', label: 'Cache Read', value: tokenBreakdown.cache_read_tokens, color: '#3b82f6' },
    { key: 'cache_creation_tokens', label: 'Cache Creation', value: tokenBreakdown.cache_creation_tokens, color: '#a855f7' }
  ];

  return (
    <Card className={`${colors.bg} border-l-4 ${colors.border}`}>
      <CardContent>
        <div className="flex items-start justify-between mb-4">
          <Typography variant="subtitle2" className="text-gray-600 font-medium">
            {title}
          </Typography>
          {icon && (
            <div className={colors.icon}>
              {icon}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {tokenTypes.map((tokenType) => {
            const percentage = totalTokens > 0 ? (tokenType.value / totalTokens) * 100 : 0;
            return (
              <div key={tokenType.key} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tokenType.color }}
                />
                <div className="flex-1">
                  <div className="text-gray-600 text-xs">{tokenType.label}</div>
                  <div className="font-semibold">{tokenType.value.toLocaleString()}</div>
                  <div className="text-gray-500 text-xs">{percentage.toFixed(1)}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TokenBreakdownCard;
