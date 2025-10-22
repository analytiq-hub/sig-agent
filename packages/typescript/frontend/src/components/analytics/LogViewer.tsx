'use client'

import React, { useState } from 'react';
import { Card, CardContent, Typography, Box, Chip, TextField, InputAdornment } from '@mui/material';
import { Search as SearchIcon, CheckCircle as SuccessIcon, Error as ErrorIcon, Info as InfoIcon } from '@mui/icons-material';

export interface LogEntry {
  timestamp: string | Date;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface LogViewerProps {
  title: string;
  logs: LogEntry[];
  maxHeight?: number;
  showSearch?: boolean;
}

const LogViewer: React.FC<LogViewerProps> = ({
  title,
  logs,
  maxHeight = 400,
  showSearch = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log =>
    log.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <SuccessIcon className="h-4 w-4 text-green-600" />;
      case 'error':
        return <ErrorIcon className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <ErrorIcon className="h-4 w-4 text-yellow-600" />;
      default:
        return <InfoIcon className="h-4 w-4 text-blue-600" />;
    }
  };

  const getLevelColor = (level: string): 'success' | 'error' | 'warning' | 'info' => {
    switch (level) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  const formatTimestamp = (timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <Typography variant="h6" className="font-semibold">
            {title}
          </Typography>
          <Typography variant="caption" className="text-gray-500">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
          </Typography>
        </div>

        {showSearch && (
          <TextField
            fullWidth
            size="small"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-3"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon className="h-4 w-4" />
                </InputAdornment>
              ),
            }}
          />
        )}

        <Box
          sx={{
            maxHeight,
            overflowY: 'auto',
            backgroundColor: '#f5f5f5',
            borderRadius: 1,
            padding: 2
          }}
        >
          {filteredLogs.length === 0 ? (
            <Typography variant="body2" className="text-gray-500 text-center py-4">
              No log entries found
            </Typography>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className="bg-white rounded p-3 shadow-sm border border-gray-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getLevelIcon(log.level)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Chip
                          label={log.level.toUpperCase()}
                          size="small"
                          color={getLevelColor(log.level)}
                          sx={{ height: '20px', fontSize: '0.7rem' }}
                        />
                        <Typography variant="caption" className="text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </Typography>
                      </div>
                      <Typography
                        variant="body2"
                        className="font-mono text-sm break-words"
                      >
                        {log.message}
                      </Typography>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <Box className="mt-2 p-2 bg-gray-50 rounded">
                          <Typography variant="caption" className="text-gray-600 font-semibold">
                            Metadata:
                          </Typography>
                          <pre className="text-xs mt-1 overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </Box>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default LogViewer;
