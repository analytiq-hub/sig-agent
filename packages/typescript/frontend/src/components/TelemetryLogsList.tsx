import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DocRouterOrgApi } from '@/utils/api';
import { getApiErrorMsg } from '@/utils/api';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { 
  TextField, 
  InputAdornment, 
  Chip, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import BuildIcon from '@mui/icons-material/Build';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ApiIcon from '@mui/icons-material/Api';
import PersonIcon from '@mui/icons-material/Person';
import { Tag, TelemetryLogResponse } from '@docrouter/sdk';
import { formatLocalDateWithTZ } from '@/utils/date';

type TelemetryLog = TelemetryLogResponse;

const severityColors: Record<string, string> = {
  'TRACE': 'default',
  'DEBUG': 'info',
  'INFO': 'success',
  'WARN': 'warning',
  'ERROR': 'error',
  'FATAL': 'error'
};

const TelemetryLogsList: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const docRouterOrgApi = useMemo(() => new DocRouterOrgApi(organizationId), [organizationId]);
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedLog, setSelectedLog] = useState<TelemetryLogResponse | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(-1);
  const [selectedTab, setSelectedTab] = useState<number>(0);

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await docRouterOrgApi.listLogs({
        skip: page * pageSize,
        limit: pageSize,
        severity: severityFilter || undefined
      });
      setLogs(response.logs);
      setTotal(response.total);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading logs';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, severityFilter, docRouterOrgApi]);

  const loadTags = useCallback(async () => {
    try {
      const response = await docRouterOrgApi.listTags({ limit: 100 });
      setAvailableTags(response.tags);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading tags';
      setMessage('Error: ' + errorMsg);
    }
  }, [docRouterOrgApi]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([loadLogs(), loadTags()]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [loadLogs, loadTags]);

  const getTagName = (tagId: string) => {
    const tag = availableTags.find(t => t.id === tagId);
    return tag?.name || tagId;
  };

  const handleLogClick = (log: TelemetryLog) => {
    const index = filteredLogs.findIndex(l => l.log_id === log.log_id);
    setSelectedLog(log);
    setSelectedLogIndex(index);
    setDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedLog(null);
    setSelectedLogIndex(-1);
    setSelectedTab(0);
  };

  const handleNavigateLog = (direction: 'prev' | 'next') => {
    if (selectedLogIndex === -1) return;
    
    const newIndex = direction === 'prev' ? selectedLogIndex - 1 : selectedLogIndex + 1;
    
    if (newIndex >= 0 && newIndex < filteredLogs.length) {
      const newLog = filteredLogs[newIndex];
      setSelectedLog(newLog);
      setSelectedLogIndex(newIndex);
      // Keep the same tab selected when navigating
    }
  };


  // Function to render tab content
  const renderTabContent = (log: TelemetryLogResponse) => {
    switch (selectedTab) {
      case 0: // Basic Information
        return (
          <Box>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" sx={{ tableLayout: 'fixed' }}>
                <TableBody>
                  <TableRow sx={{ backgroundColor: 'background.default' }}>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Log ID</strong>
                        <span>{log.log_id}</span>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Severity</strong>
                        <span>
                          {log.severity && (
                            <Chip
                              label={log.severity}
                              size="small"
                              color={severityColors[log.severity] as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' || 'default'}
                            />
                          )}
                        </span>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Timestamp</strong>
                        <span>{formatLocalDateWithTZ(log.timestamp, true)}</span>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Upload Date</strong>
                        <span>{formatLocalDateWithTZ(log.upload_date, true)}</span>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'background.default' }}>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Trace ID</strong>
                        <span>{log.trace_id || '-'}</span>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Span ID</strong>
                        <span>{log.span_id || '-'}</span>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Uploaded By</strong>
                        <span>{log.uploaded_by}</span>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Message</strong>
                        <span>{log.body}</span>
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );
      case 1: // Attributes
        return (
          <Box>
            {log.attributes && Object.keys(log.attributes).length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '50%' }}><strong>Key</strong></TableCell>
                      <TableCell sx={{ width: '50%' }}><strong>Value</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(log.attributes).map(([key, value], index) => (
                      <TableRow 
                        key={key}
                        sx={{ 
                          backgroundColor: index % 2 === 0 ? 'background.default' : 'action.hover' 
                        }}
                      >
                        <TableCell sx={{ width: '50%' }}>{key}</TableCell>
                        <TableCell sx={{ width: '50%' }}>
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No attributes available</Typography>
            )}
          </Box>
        );
      case 2: // Resource
        return (
          <Box>
            {log.resource && Object.keys(log.resource).length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '50%' }}><strong>Key</strong></TableCell>
                      <TableCell sx={{ width: '50%' }}><strong>Value</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(parseResourceAttributes(log.resource)).map(([key, value], index) => (
                      <TableRow 
                        key={key}
                        sx={{ 
                          backgroundColor: index % 2 === 0 ? 'background.default' : 'action.hover' 
                        }}
                      >
                        <TableCell sx={{ width: '50%' }}>{key}</TableCell>
                        <TableCell sx={{ width: '50%' }}>{String(value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No resource information available</Typography>
            )}
          </Box>
        );
      case 3: // Metadata
        return (
          <Box>
            {log.metadata && Object.keys(log.metadata).length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '50%' }}><strong>Key</strong></TableCell>
                      <TableCell sx={{ width: '50%' }}><strong>Value</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(log.metadata).map(([key, value], index) => (
                      <TableRow 
                        key={key}
                        sx={{ 
                          backgroundColor: index % 2 === 0 ? 'background.default' : 'action.hover' 
                        }}
                      >
                        <TableCell sx={{ width: '50%' }}>{key}</TableCell>
                        <TableCell sx={{ width: '50%' }}>{value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No metadata available</Typography>
            )}
          </Box>
        );
      default:
        return null;
    }
  };


  // Helper function to parse OpenTelemetry resource attributes
  const parseResourceAttributes = (resource: Record<string, unknown>) => {
    // Check if this is the OpenTelemetry format with attributes array
    if (resource.attributes && Array.isArray(resource.attributes)) {
      const parsedAttributes: Record<string, string> = {};
      resource.attributes.forEach((attr: unknown) => {
        const typedAttr = attr as Record<string, unknown>;
        if (typedAttr.key && typedAttr.value) {
          const value = typedAttr.value as Record<string, unknown>;
          // Handle different value types from OpenTelemetry
          if (value.stringValue) {
            parsedAttributes[typedAttr.key as string] = value.stringValue as string;
          } else if (value.intValue !== undefined) {
            parsedAttributes[typedAttr.key as string] = (value.intValue as number).toString();
          } else if (value.doubleValue !== undefined) {
            parsedAttributes[typedAttr.key as string] = (value.doubleValue as number).toString();
          } else if (value.boolValue !== undefined) {
            parsedAttributes[typedAttr.key as string] = (value.boolValue as boolean).toString();
          } else if (value.arrayValue) {
            parsedAttributes[typedAttr.key as string] = JSON.stringify(value.arrayValue);
          } else if (value.kvlistValue) {
            parsedAttributes[typedAttr.key as string] = JSON.stringify(value.kvlistValue);
          } else {
            parsedAttributes[typedAttr.key as string] = JSON.stringify(value);
          }
        }
      });
      return parsedAttributes;
    }
    
    // If not in OpenTelemetry format, return as-is
    return resource;
  };

  // Helper function to extract salient information from attributes
  const getSalientInfo = (log: TelemetryLog) => {
    const attrs = log.attributes || {};
    return {
      eventName: attrs['event.name'] as string || '-',
      toolName: attrs['tool_name'] as string || '-',
      success: attrs['success'] || '-',
      duration: attrs['duration_ms'] as number | string || '-',
      decision: attrs['decision'] as string || '-',
      source: attrs['source'] as string || attrs['decision_source'] as string || '-',
      sessionId: attrs['session.id'] as string || '-'
    };
  };

  // Helper function to get icon for event type with color coding
  const getEventIcon = (eventName: string) => {
    switch (eventName) {
      case 'tool_result':
        return <BuildIcon fontSize="small" sx={{ color: '#2e7d32' }} />; // Green for successful tool execution
      case 'tool_decision':
        return <PsychologyIcon fontSize="small" sx={{ color: '#1976d2' }} />; // Blue for AI decision-making
      case 'api_request':
        return <ApiIcon fontSize="small" sx={{ color: '#ed6c02' }} />; // Orange for API calls
      case 'user_prompt':
        return <PersonIcon fontSize="small" sx={{ color: '#9c27b0' }} />; // Purple for user interaction
      default:
        return null;
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'timestamp',
      headerName: 'Timestamp',
      width: 140,
      renderCell: (params) => (
        <span className="text-sm">{formatLocalDateWithTZ(params.value, true)}</span>
      )
    },
    {
      field: 'event_name',
      headerName: 'Event',
      width: 120,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        const icon = getEventIcon(info.eventName);
        return (
          <Box display="flex" alignItems="center" gap={0.5}>
            {icon}
            <span className="text-sm font-medium">
              {info.eventName}
            </span>
          </Box>
        );
      }
    },
    {
      field: 'tool_name',
      headerName: 'Tool',
      width: 180,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        return (
          <span className="text-sm font-mono">
            {info.toolName}
          </span>
        );
      }
    },
    {
      field: 'success',
      headerName: 'Status',
      width: 80,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        const success = info.success;
        if (success === true || String(success) === 'true') {
          return <Chip label="✓" size="small" color="success" sx={{ height: '20px', fontSize: '0.75rem' }} />;
        } else if (success === false || String(success) === 'false') {
          return <Chip label="✗" size="small" color="error" sx={{ height: '20px', fontSize: '0.75rem' }} />;
        }
        return <span className="text-sm">-</span>;
      }
    },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 80,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        const duration = info.duration;
        if (typeof duration === 'number' || (typeof duration === 'string' && !isNaN(Number(duration)))) {
          return <span className="text-sm font-mono">{duration}ms</span>;
        }
        return <span className="text-sm">-</span>;
      }
    },
    {
      field: 'decision',
      headerName: 'Decision',
      width: 80,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        const decision = info.decision;
        if (decision && decision !== '-') {
          const color = decision === 'accept' ? 'success' : decision === 'reject' ? 'error' : 'default';
          return (
            <Chip
              label={decision}
              size="small"
              color={color as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
              sx={{ height: '20px', fontSize: '0.75rem' }}
            />
          );
        }
        return <span className="text-sm">-</span>;
      }
    },
    {
      field: 'body',
      headerName: 'Message',
      flex: 2,
      minWidth: 200,
      renderCell: (params) => (
        <span className="text-sm truncate">{params.value}</span>
      )
    },
    {
      field: 'session_id',
      headerName: 'Session',
      width: 120,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        return (
          <span className="text-xs font-mono">
            {info.sessionId.substring(0, 8)}...
          </span>
        );
      }
    }
  ];

  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    return logs.filter(log =>
      log.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.trace_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);

  return (
    <div className="w-full">
      <div className="mb-4 flex gap-4">
        <TextField
          fullWidth
          size="small"
          placeholder="Search logs by message or trace ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Severity</InputLabel>
          <Select
            value={severityFilter}
            label="Severity"
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="TRACE">TRACE</MenuItem>
            <MenuItem value="DEBUG">DEBUG</MenuItem>
            <MenuItem value="INFO">INFO</MenuItem>
            <MenuItem value="WARN">WARN</MenuItem>
            <MenuItem value="ERROR">ERROR</MenuItem>
            <MenuItem value="FATAL">FATAL</MenuItem>
          </Select>
        </FormControl>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {message}
        </div>
      )}

      <DataGrid
        rows={filteredLogs}
        columns={columns}
        getRowId={(row) => row.log_id}
        pagination
        paginationMode="server"
        rowCount={total}
        paginationModel={{ page, pageSize }}
        onPaginationModelChange={(model) => {
          setPage(model.page);
          setPageSize(model.pageSize);
        }}
        pageSizeOptions={[5, 10, 25, 50]}
        loading={isLoading}
        disableRowSelectionOnClick
        onRowClick={(params) => handleLogClick(params.row)}
        autoHeight
        sx={{
          '& .MuiDataGrid-cell': {
            padding: '8px',
          },
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
          }
        }}
      />

      {/* Detail Modal */}
      <Dialog 
        open={detailModalOpen} 
        onClose={handleCloseDetailModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Telemetry Log Details</Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">
                {selectedLogIndex + 1} of {filteredLogs.length}
              </Typography>
              <Tooltip title="Previous log">
                <IconButton
                  size="small"
                  onClick={() => handleNavigateLog('prev')}
                  disabled={selectedLogIndex <= 0}
                  sx={{
                    boxShadow: 2,
                    backgroundColor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      boxShadow: 4,
                      backgroundColor: 'action.hover',
                    },
                    '&:disabled': {
                      boxShadow: 1,
                      backgroundColor: 'action.disabledBackground',
                      borderColor: 'action.disabled',
                    }
                  }}
                >
                  <NavigateBeforeIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Next log">
                <IconButton
                  size="small"
                  onClick={() => handleNavigateLog('next')}
                  disabled={selectedLogIndex >= filteredLogs.length - 1}
                  sx={{
                    boxShadow: 2,
                    backgroundColor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      boxShadow: 4,
                      backgroundColor: 'action.hover',
                    },
                    '&:disabled': {
                      boxShadow: 1,
                      backgroundColor: 'action.disabledBackground',
                      borderColor: 'action.disabled',
                    }
                  }}
                >
                  <NavigateNextIcon />
                </IconButton>
              </Tooltip>
              <Button onClick={handleCloseDetailModal} variant="outlined" size="small">
                Close
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box>
              {/* Summary Information */}
              <Box mb={3}>
                <Typography variant="h6" gutterBottom>Summary</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableBody>
                      {(() => {
                        const info = getSalientInfo(selectedLog);
                        return (
                          <>
                            <TableRow sx={{ backgroundColor: 'background.default' }}>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Event</strong>
                                  <Box display="flex" alignItems="center" gap={0.5}>
                                    {getEventIcon(info.eventName)}
                                    <span>{info.eventName}</span>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Tool</strong>
                                  <span className="font-mono">{info.toolName}</span>
                                </Box>
                              </TableCell>
                            </TableRow>
                            <TableRow sx={{ backgroundColor: 'action.hover' }}>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Status</strong>
                                  <span>
                                    {info.success === true || String(info.success) === 'true' ? (
                                      <Chip label="✓ Success" size="small" color="success" />
                                    ) : info.success === false || String(info.success) === 'false' ? (
                                      <Chip label="✗ Failed" size="small" color="error" />
                                    ) : (
                                      <span>-</span>
                                    )}
                                  </span>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Duration</strong>
                                  <span>
                                    {info.duration !== '-' ? (
                                      <span className="font-mono">{info.duration}ms</span>
                                    ) : (
                                      <span>-</span>
                                    )}
                                  </span>
                                </Box>
                              </TableCell>
                            </TableRow>
                            <TableRow sx={{ backgroundColor: 'background.default' }}>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Decision</strong>
                                  <span>
                                    {info.decision !== '-' ? (
                                      <Chip
                                        label={info.decision}
                                        size="small"
                                        color={info.decision === 'accept' ? 'success' : info.decision === 'reject' ? 'error' : 'default'}
                                      />
                                    ) : (
                                      <span>-</span>
                                    )}
                                  </span>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Source</strong>
                                  <span>{info.source}</span>
                                </Box>
                              </TableCell>
                            </TableRow>
                            <TableRow sx={{ backgroundColor: 'action.hover' }}>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Session</strong>
                                  <span className="font-mono text-xs">{info.sessionId}</span>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Timestamp</strong>
                                  <span>{formatLocalDateWithTZ(selectedLog.timestamp, true)}</span>
                                </Box>
                              </TableCell>
                            </TableRow>
                          </>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Tabs for detailed information */}
              <Box mb={3}>
                {/* Custom tab buttons */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                  <Box display="flex">
                    {['Basic Information', 'Attributes', 'Resource', 'Metadata'].map((label, index) => (
                      <Button
                        key={index}
                        onClick={() => setSelectedTab(index)}
                        variant="text"
                        sx={{
                          flex: 1,
                          textTransform: 'none',
                          borderRadius: 0,
                          borderBottom: selectedTab === index ? 3 : 1,
                          borderBottomColor: selectedTab === index ? 'primary.main' : 'divider',
                          backgroundColor: selectedTab === index ? 'primary.light' : 'transparent',
                          color: selectedTab === index ? 'primary.contrastText' : 'text.primary',
                          fontWeight: selectedTab === index ? 600 : 400,
                          '&:hover': {
                            backgroundColor: selectedTab === index ? 'primary.light' : 'action.hover',
                            borderBottomColor: selectedTab === index ? 'primary.main' : 'primary.light',
                          }
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </Box>
                </Box>
                <Box mt={2}>
                  {/* Debug info - remove this later */}
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Debug: Selected tab = {selectedTab}
                  </Typography>
                  {renderTabContent(selectedLog)}
                </Box>
              </Box>

              {/* Tags */}
              {selectedLog.tag_ids && selectedLog.tag_ids.length > 0 && (
                <Box mb={3}>
                  <Typography variant="h6" gutterBottom>Tags</Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {selectedLog.tag_ids.map((tagId) => (
                      <Chip
                        key={tagId}
                        label={getTagName(tagId)}
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TelemetryLogsList;
