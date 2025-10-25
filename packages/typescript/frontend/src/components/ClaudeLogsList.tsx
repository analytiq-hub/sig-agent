import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DocRouterOrgApi } from '@/utils/api';
import { getApiErrorMsg } from '@/utils/api';
import { DataGrid, GridColDef, GridFilterInputValueProps } from '@mui/x-data-grid';
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
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import BuildIcon from '@mui/icons-material/Build';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ApiIcon from '@mui/icons-material/Api';
import PersonIcon from '@mui/icons-material/Person';
import StopIcon from '@mui/icons-material/Stop';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CompactIcon from '@mui/icons-material/Compress';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import FilterListIcon from '@mui/icons-material/FilterList';
import { ClaudeLogItem } from '@docrouter/sdk';
import { formatLocalDateWithTZ } from '@/utils/date';

type ClaudeLog = ClaudeLogItem;

// Custom Date Range Filter Component
const DateRangeFilter: React.FC<GridFilterInputValueProps> = ({ item, applyValue }) => {
  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState<string>(getTodayDate());
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endDate, setEndDate] = useState<string>(getTodayDate());
  const [endTime, setEndTime] = useState<string>('23:59');

  const handleApply = () => {
    const startDateTime = `${startDate}T${startTime}`;
    const endDateTime = `${endDate}T${endTime}`;
    const filterValue = startDateTime && endDateTime ? `${startDateTime}|${endDateTime}` : '';
    applyValue({ ...item, value: filterValue });
  };

  const handleClear = () => {
    setStartDate(getTodayDate());
    setStartTime('00:00');
    setEndDate(getTodayDate());
    setEndTime('23:59');
    applyValue({ ...item, value: '' });
  };

  return (
    <Box sx={{ p: 1.5, width: '100%', maxWidth: 'none' }}>
      <Typography variant="caption" sx={{ mb: 1.5, fontWeight: 600, fontSize: '0.75rem', display: 'block' }}>
        Date Range
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ minWidth: '35px', fontSize: '0.7rem' }}>
            From:
          </Typography>
          <TextField
            size="small"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ 
              width: '90px',
              '& .MuiInputBase-input': {
                fontSize: '0.7rem',
                padding: '4px 6px'
              }
            }}
            variant="outlined"
          />
          <TextField
            size="small"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            sx={{ 
              width: '70px',
              '& .MuiInputBase-input': {
                fontSize: '0.7rem',
                padding: '4px 6px'
              }
            }}
            variant="outlined"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ minWidth: '35px', fontSize: '0.7rem' }}>
            To:
          </Typography>
          <TextField
            size="small"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ 
              width: '90px',
              '& .MuiInputBase-input': {
                fontSize: '0.7rem',
                padding: '4px 6px'
              }
            }}
            variant="outlined"
          />
          <TextField
            size="small"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            sx={{ 
              width: '70px',
              '& .MuiInputBase-input': {
                fontSize: '0.7rem',
                padding: '4px 6px'
              }
            }}
            variant="outlined"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', mt: 0.5 }}>
          <Button size="small" variant="outlined" onClick={handleClear} sx={{ fontSize: '0.7rem', minWidth: '50px', height: '24px' }}>
            Clear
          </Button>
          <Button size="small" variant="contained" onClick={handleApply} sx={{ fontSize: '0.7rem', minWidth: '50px', height: '24px' }}>
            Apply
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

const ClaudeLogsList: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const docRouterOrgApi = useMemo(() => new DocRouterOrgApi(organizationId), [organizationId]);
  const [logs, setLogs] = useState<ClaudeLog[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionIdFilter, setSessionIdFilter] = useState('');
  const [hookEventNameFilter, setHookEventNameFilter] = useState('');
  const [toolNameFilter, setToolNameFilter] = useState('');
  const [permissionModeFilter, setPermissionModeFilter] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ClaudeLogItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(-1);
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [showRawData, setShowRawData] = useState(false);
  const [filteredSessionId, setFilteredSessionId] = useState<string | null>(null);
  const rawDataRef = useRef<HTMLDivElement>(null);

  // Handle date range filter from DataGrid
  const handleDateRangeFilter = (filterValue: string) => {
    if (filterValue && filterValue.includes('|')) {
      const [start, end] = filterValue.split('|');
      setStartDate(start);
      setEndDate(end);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const response = await docRouterOrgApi.listClaudeLogs({
          skip: page * pageSize,
          limit: pageSize,
          start_time: startDate || undefined,
          end_time: endDate || undefined,
          session_id: sessionIdFilter || undefined,
          hook_event_name: hookEventNameFilter || undefined,
          tool_name: toolNameFilter || undefined,
          permission_mode: permissionModeFilter || undefined
        });
        setLogs(response.logs);
        setTotal(response.total);
      } catch (error) {
        const errorMsg = getApiErrorMsg(error) || 'Error loading Claude logs';
        setMessage('Error: ' + errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [page, pageSize, startDate, endDate, sessionIdFilter, hookEventNameFilter, toolNameFilter, permissionModeFilter, docRouterOrgApi]);

  // Debounced search effect - reset to first page when search parameters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPage(0); // Reset to first page when search changes
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [sessionIdFilter, hookEventNameFilter, toolNameFilter, permissionModeFilter, startDate, endDate]);


  const handleLogClick = (log: ClaudeLog) => {
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
    setShowRawData(false);
    setFilteredSessionId(null);
  };

  const handleToggleRawData = () => {
    const newShowRawData = !showRawData;
    setShowRawData(newShowRawData);
    
    // If toggling on, scroll to raw data after a short delay to allow DOM update
    if (newShowRawData && rawDataRef.current) {
      setTimeout(() => {
        rawDataRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  };

  const handleFilterBySession = (sessionId: string) => {
    // Toggle the session filter
    if (filteredSessionId === sessionId) {
      // If this session is already filtered, clear the filter
      setFilteredSessionId(null);
      setSessionIdFilter('');
    } else {
      // Set the new session filter
      setFilteredSessionId(sessionId);
      setSessionIdFilter(sessionId);
    }
    // Reset to first page when filtering
    setPage(0);
  };

  const handleNavigateLog = async (direction: 'prev' | 'next') => {
    if (selectedLogIndex === -1) return;
    
    const newIndex = direction === 'prev' ? selectedLogIndex - 1 : selectedLogIndex + 1;
    
    // Check if we need to load a different page
    if (direction === 'next' && newIndex >= filteredLogs.length) {
      // We're at the end of current page, load next page
      const nextPage = page + 1;
      const totalPages = Math.ceil(total / pageSize);
      
      if (nextPage < totalPages) {
        try {
          setIsLoading(true);
          const response = await docRouterOrgApi.listClaudeLogs({
            skip: nextPage * pageSize,
            limit: pageSize,
            start_time: startDate || undefined,
            end_time: endDate || undefined,
            session_id: sessionIdFilter || undefined,
            hook_event_name: hookEventNameFilter || undefined,
            tool_name: toolNameFilter || undefined,
            permission_mode: permissionModeFilter || undefined
          });
          
          if (response.logs.length > 0) {
            // Load the first element of the next page
            setPage(nextPage);
            setLogs(response.logs);
            setTotal(response.total);
            setSelectedLog(response.logs[0]);
            setSelectedLogIndex(0);
          }
        } catch (error) {
          const errorMsg = getApiErrorMsg(error) || 'Error loading next page';
          setMessage('Error: ' + errorMsg);
        } finally {
          setIsLoading(false);
        }
      }
      return;
    }
    
    if (direction === 'prev' && newIndex < 0) {
      // We're at the beginning of current page, load previous page
      const prevPage = page - 1;
      
      if (prevPage >= 0) {
        try {
          setIsLoading(true);
          const response = await docRouterOrgApi.listClaudeLogs({
            skip: prevPage * pageSize,
            limit: pageSize,
            start_time: startDate || undefined,
            end_time: endDate || undefined,
            session_id: sessionIdFilter || undefined,
            hook_event_name: hookEventNameFilter || undefined,
            tool_name: toolNameFilter || undefined,
            permission_mode: permissionModeFilter || undefined
          });
          
          if (response.logs.length > 0) {
            // Load the last element of the previous page
            setPage(prevPage);
            setLogs(response.logs);
            setTotal(response.total);
            const lastIndex = response.logs.length - 1;
            setSelectedLog(response.logs[lastIndex]);
            setSelectedLogIndex(lastIndex);
          }
        } catch (error) {
          const errorMsg = getApiErrorMsg(error) || 'Error loading previous page';
          setMessage('Error: ' + errorMsg);
        } finally {
          setIsLoading(false);
        }
      }
      return;
    }
    
    // Normal navigation within current page
    if (newIndex >= 0 && newIndex < filteredLogs.length) {
      const newLog = filteredLogs[newIndex];
      setSelectedLog(newLog);
      setSelectedLogIndex(newIndex);
      // Keep the same tab selected when navigating
    }
  };

  // Function to render tab content
  const renderTabContent = (log: ClaudeLogItem) => {
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
                        <strong>Organization ID</strong>
                        <span>{log.organization_id}</span>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Hook Timestamp</strong>
                        <span>{formatLocalDateWithTZ(log.hook_timestamp, true)}</span>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Upload Timestamp</strong>
                        <span>{formatLocalDateWithTZ(log.upload_timestamp, true)}</span>
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );
      case 1: // Hook Data
        return (
          <Box>
            {log.hook_stdin && Object.keys(log.hook_stdin).length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '50%' }}><strong>Key</strong></TableCell>
                      <TableCell sx={{ width: '50%' }}><strong>Value</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(log.hook_stdin).map(([key, value], index) => (
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
              <Typography color="text.secondary">No hook data available</Typography>
            )}
          </Box>
        );
      default:
        return null;
    }
  };

  // Helper function to extract salient information from hook_stdin
  const getSalientInfo = (log: ClaudeLog) => {
    const hookData = log.hook_stdin || {};
    return {
      sessionId: hookData['session_id'] as string || '-',
      hookEventName: hookData['hook_event_name'] as string || '-',
      toolName: hookData['tool_name'] as string || '-',
      permissionMode: hookData['permission_mode'] as string || '-',
      userId: hookData['user_id'] as string || '-',
      model: hookData['model'] as string || '-',
      toolInput: hookData['tool_input'] || null,
      toolResponse: hookData['tool_response'] || null,
      prompt: hookData['prompt'] as string || null
    };
  };

  // Helper function to generate a consistent color for a session ID
  const getSessionColor = (sessionId: string): string => {
    // Simple hash function to convert session ID to a number
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      const char = sessionId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use absolute value and modulo to get a positive number
    const positiveHash = Math.abs(hash);
    
    // Define a palette of colors that contrast well with white
    const colors = [
      '#1976d2', // Blue
      '#388e3c', // Green
      '#f57c00', // Orange
      '#7b1fa2', // Purple
      '#c2185b', // Pink
      '#00796b', // Teal
      '#5d4037', // Brown
      '#455a64', // Blue Grey
      '#e64a19', // Deep Orange
      '#303f9f', // Indigo
      '#689f38', // Light Green
      '#d32f2f', // Red
      '#512da8', // Deep Purple
      '#fbc02d', // Yellow
      '#795548', // Brown
      '#607d8b'  // Blue Grey
    ];
    
    // Use modulo to select a color from the palette
    return colors[positiveHash % colors.length];
  };

  // Helper function to format tool response for display
  const formatToolResponse = (response: unknown): string => {
    if (!response) return '';
    
    // If it's an array with one element of type "text"
    if (Array.isArray(response) && response.length === 1 && response[0]?.type === 'text') {
      const textContent = response[0].text;
      
      // Try to parse as JSON if it looks like stringified JSON
      try {
        const parsed = JSON.parse(textContent);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // If not valid JSON, return as-is
        return textContent;
      }
    }
    
    // For other formats, stringify normally
    return typeof response === 'string' ? response : JSON.stringify(response, null, 2);
  };

  // Custom Tooltip component for user prompt information
  const PromptTooltip: React.FC<{ log: ClaudeLog; children: React.ReactElement }> = ({ log, children }) => {
    const info = getSalientInfo(log);
    
    if (!info.prompt || info.hookEventName !== 'UserPromptSubmit') {
      return <>{children}</>;
    }

    const tooltipContent = (
      <Box sx={{ maxWidth: 400, maxHeight: 300, overflow: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
          User Prompt
        </Typography>
        <Box 
          component="pre" 
          sx={{ 
            fontSize: '0.75rem', 
            fontFamily: 'monospace',
            backgroundColor: 'grey.50',
            color: 'text.primary',
            padding: 1,
            borderRadius: 1,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflow: 'auto'
          }}
        >
          {info.prompt}
        </Box>
      </Box>
    );

    return (
      <Tooltip 
        title={tooltipContent}
        placement="right"
        arrow
        componentsProps={{
          tooltip: {
            sx: {
              maxWidth: 400,
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 3
            }
          }
        }}
      >
        {children}
      </Tooltip>
    );
  };

  // Custom Tooltip component for tool information
  const ToolInfoTooltip: React.FC<{ log: ClaudeLog; children: React.ReactElement }> = ({ log, children }) => {
    const info = getSalientInfo(log);
    const hasToolData = info.toolInput || info.toolResponse;
    
    if (!hasToolData) {
      return <Tooltip title={info.toolName}>{children}</Tooltip>;
    }

    const tooltipContent = (
      <Box sx={{ maxWidth: 400, maxHeight: 300, overflow: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
          {info.toolName}
        </Typography>
        
        {info.toolInput && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              Input:
            </Typography>
            <Box 
              component="pre" 
              sx={{ 
                fontSize: '0.75rem', 
                fontFamily: 'monospace',
                backgroundColor: 'grey.100',
                color: 'text.primary',
                padding: 1,
                borderRadius: 1,
                marginTop: 0.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 120,
                overflow: 'auto'
              }}
            >
              {typeof info.toolInput === 'string' 
                ? info.toolInput 
                : JSON.stringify(info.toolInput, null, 2)
              }
            </Box>
          </Box>
        )}
        
        {info.toolResponse && (
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'success.main' }}>
              Response:
            </Typography>
            <Box 
              component="pre" 
              sx={{ 
                fontSize: '0.75rem', 
                fontFamily: 'monospace',
                backgroundColor: 'grey.50',
                color: 'text.primary',
                padding: 1,
                borderRadius: 1,
                marginTop: 0.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 120,
                overflow: 'auto'
              }}
            >
              {formatToolResponse(info.toolResponse)}
            </Box>
          </Box>
        )}
      </Box>
    );

    return (
      <Tooltip 
        title={tooltipContent}
        placement="right"
        arrow
        componentsProps={{
          tooltip: {
            sx: {
              maxWidth: 400,
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 3
            }
          }
        }}
      >
        {children}
      </Tooltip>
    );
  };

  // Helper function to get icon for event type with color coding
  // Color scheme:
  // - Green (#2e7d32): Pre-tool operations (PreToolUse)
  // - Teal (#00acc1): Post-tool operations (PostToolUse)
  // - Orange (#ed6c02): System operations (PreCompact, Notification, API calls)
  // - Purple (#9c27b0): User interactions (UserPromptSubmit)
  // - Blue (#1976d2): Session lifecycle (SessionStart, SessionEnd, messages)
  // - Red (#d32f2f): Control flow stops (Stop, SubagentStop)
  // - Gray (#757575): Unknown/fallback events
  const getEventIcon = (eventName: string) => {
    switch (eventName) {
      // Tool-related hooks
      case 'PreToolUse':
        return <BuildIcon fontSize="small" sx={{ color: '#2e7d32' }} />; // Green wrench for pre-tool execution
      case 'PostToolUse':
        return <BuildIcon fontSize="small" sx={{ color: '#00acc1' }} />; // Teal wrench for post-tool execution
      case 'tool_use':
        return <BuildIcon fontSize="small" sx={{ color: '#2e7d32' }} />; // Green for tool usage (legacy)
      
      // User interaction hooks
      case 'UserPromptSubmit':
        return <PersonIcon fontSize="small" sx={{ color: '#9c27b0' }} />; // Purple for user interaction
      case 'user_prompt':
        return <PersonIcon fontSize="small" sx={{ color: '#9c27b0' }} />; // Purple for user interaction (legacy)
      
      // Session lifecycle hooks
      case 'SessionStart':
        return <LoginIcon fontSize="small" sx={{ color: '#1976d2' }} />; // Blue for session start
      case 'SessionEnd':
        return <LogoutIcon fontSize="small" sx={{ color: '#1976d2' }} />; // Blue for session end
      
      // Control flow hooks
      case 'Stop':
        return <StopIcon fontSize="small" sx={{ color: '#d32f2f' }} />; // Red for stop
      case 'SubagentStop':
        return <SubdirectoryArrowRightIcon fontSize="small" sx={{ color: '#d32f2f' }} />; // Red for subagent stop
      
      // System hooks
      case 'PreCompact':
        return <CompactIcon fontSize="small" sx={{ color: '#ed6c02' }} />; // Orange for compaction
      case 'Notification':
        return <NotificationsIcon fontSize="small" sx={{ color: '#ed6c02' }} />; // Orange for notifications
      
      // Legacy/fallback cases
      case 'message':
        return <PsychologyIcon fontSize="small" sx={{ color: '#1976d2' }} />; // Blue for messages
      case 'api_request':
        return <ApiIcon fontSize="small" sx={{ color: '#ed6c02' }} />; // Orange for API calls
      
      default:
        return <PsychologyIcon fontSize="small" sx={{ color: '#757575' }} />; // Gray for unknown events
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'hook_timestamp',
      headerName: 'Timestamp',
      width: 140,
      filterable: true,
      sortable: true,
      filterOperators: [
        {
          label: 'Date Range',
          value: 'dateRange',
          getApplyFilterFn: (filterItem) => {
            if (!filterItem.value) return null;
            const [startDate, endDate] = filterItem.value.split('|');
            return (params) => {
              const logDate = new Date(params.value);
              const start = new Date(startDate);
              const end = new Date(endDate);
              return logDate >= start && logDate <= end;
            };
          },
          InputComponent: DateRangeFilter,
        },
      ],
      renderCell: (params) => (
        <span className="text-sm">{formatLocalDateWithTZ(params.value, true)}</span>
      )
    },
    {
      field: 'hook_event_name',
      headerName: 'Event',
      width: 160,
      filterable: false,
      sortable: false,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        const icon = getEventIcon(info.hookEventName);
        const eventContent = (
          <Box display="flex" alignItems="center" gap={0.5} sx={{ height: '100%', minHeight: '52px' }}>
            {icon}
            <span className="text-sm font-medium">
              {info.hookEventName}
            </span>
          </Box>
        );

        // Wrap UserPromptSubmit events with prompt tooltip
        if (info.hookEventName === 'UserPromptSubmit') {
          return (
            <PromptTooltip log={params.row}>
              {eventContent}
            </PromptTooltip>
          );
        }

        return eventContent;
      }
    },
    {
      field: 'tool_name',
      headerName: 'Tool',
      width: 280,
      filterable: false,
      sortable: false,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        const toolName = info.toolName;
        const displayName = toolName.length > 35 ? toolName.substring(0, 35) + '...' : toolName;
        return (
          <ToolInfoTooltip log={params.row}>
            <span className="text-sm font-mono" style={{ cursor: 'help' }}>
              {displayName}
            </span>
          </ToolInfoTooltip>
        );
      }
    },
    {
      field: 'permission_mode',
      headerName: 'Permission',
      width: 100,
      filterable: false,
      sortable: false,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        const permission = info.permissionMode;
        if (permission && permission !== '-') {
          const color = permission === 'auto' ? 'success' : permission === 'manual' ? 'warning' : 'default';
          return (
            <Chip
              label={permission}
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
      field: 'model',
      headerName: 'Model',
      width: 120,
      filterable: false,
      sortable: false,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        return (
          <span className="text-sm font-mono">
            {info.model}
          </span>
        );
      }
    },
    {
      field: 'session_id',
      headerName: 'Session',
      width: 180,
      filterable: false,
      sortable: false,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        const isFiltered = filteredSessionId === info.sessionId;
        const sessionColor = getSessionColor(info.sessionId);
        return (
          <Box display="flex" alignItems="center" gap={0.5}>
            <span className="text-xs font-mono">
              {info.sessionId.substring(0, 12)}...
            </span>
            <Tooltip title={isFiltered ? "Clear session filter" : "Filter by this session ID"}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent row click
                  handleFilterBySession(info.sessionId);
                }}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: isFiltered ? sessionColor : 'grey.100',
                  color: isFiltered ? 'white' : sessionColor,
                  boxShadow: isFiltered ? 2 : 1,
                  '&:hover': {
                    backgroundColor: isFiltered ? sessionColor : 'grey.200',
                    color: isFiltered ? 'white' : sessionColor,
                    boxShadow: 3
                  }
                }}
              >
                <FilterListIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      }
    }
  ];

  // No need for client-side filtering since we're using server-side filtering
  const filteredLogs = logs;

  return (
    <div className="w-full" data-tour="claude-logs">
      <div className="mb-4 flex gap-4">
        <TextField
          size="small"
          placeholder="Session ID..."
          value={sessionIdFilter}
          onChange={(e) => setSessionIdFilter(e.target.value)}
          sx={{ minWidth: 150 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          size="small"
          placeholder="Hook Event Name..."
          value={hookEventNameFilter}
          onChange={(e) => setHookEventNameFilter(e.target.value)}
          sx={{ minWidth: 150 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          size="small"
          placeholder="Tool Name..."
          value={toolNameFilter}
          onChange={(e) => setToolNameFilter(e.target.value)}
          sx={{ minWidth: 150 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Permission</InputLabel>
          <Select
            value={permissionModeFilter}
            label="Permission"
            onChange={(e) => setPermissionModeFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="auto">Auto</MenuItem>
            <MenuItem value="manual">Manual</MenuItem>
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
        onFilterModelChange={(model) => {
          const timestampFilter = model.items.find(item => item.field === 'hook_timestamp');
          if (timestampFilter) {
            handleDateRangeFilter(timestampFilter.value || '');
          }
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
          },
          '& .MuiDataGrid-row:nth-of-type(odd)': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
          },
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
            <Typography variant="h6">Claude Log Details</Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">
                {page * pageSize + selectedLogIndex + 1} of {total}
              </Typography>
              <Tooltip title="Previous log">
                <IconButton
                  size="small"
                  onClick={() => handleNavigateLog('prev')}
                  disabled={page === 0 && selectedLogIndex <= 0}
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
                  disabled={page * pageSize + selectedLogIndex >= total - 1}
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
                            <TableRow>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Event</strong>
                                  <Box display="flex" alignItems="center" gap={0.5}>
                                    {info.hookEventName === 'UserPromptSubmit' ? (
                                      <PromptTooltip log={selectedLog}>
                                        <Box display="flex" alignItems="center" gap={0.5}>
                                          {getEventIcon(info.hookEventName)}
                                          <span>{info.hookEventName}</span>
                                        </Box>
                                      </PromptTooltip>
                                    ) : (
                                      <>
                                        {getEventIcon(info.hookEventName)}
                                        <span>{info.hookEventName}</span>
                                      </>
                                    )}
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" alignItems="flex-start" gap={2}>
                                  <strong style={{ minWidth: '60px', flexShrink: 0 }}>Tool</strong>
                                  <span className="font-mono" style={{ wordBreak: 'break-all', lineHeight: '1.4' }}>{info.toolName}</span>
                                </Box>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Permission Mode</strong>
                                  <span>
                                    {info.permissionMode !== '-' ? (
                                      <Chip
                                        label={info.permissionMode}
                                        size="small"
                                        color={info.permissionMode === 'auto' ? 'success' : info.permissionMode === 'manual' ? 'warning' : 'default'}
                                      />
                                    ) : (
                                      <span>-</span>
                                    )}
                                  </span>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Model</strong>
                                  <span className="font-mono">{info.model}</span>
                                </Box>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                  <strong>Session</strong>
                                  <Box display="flex" alignItems="center" gap={0.5}>
                                    <span className="font-mono text-xs">{info.sessionId}</span>
                                    <Tooltip title={filteredSessionId === info.sessionId ? "Clear session filter" : "Filter by this session ID"}>
                                      <IconButton
                                        size="small"
                                        onClick={() => {
                                          handleFilterBySession(info.sessionId);
                                          handleCloseDetailModal();
                                        }}
                                        sx={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: '50%',
                                          backgroundColor: filteredSessionId === info.sessionId ? getSessionColor(info.sessionId) : 'grey.100',
                                          color: filteredSessionId === info.sessionId ? 'white' : getSessionColor(info.sessionId),
                                          boxShadow: filteredSessionId === info.sessionId ? 2 : 1,
                                          '&:hover': {
                                            backgroundColor: filteredSessionId === info.sessionId ? getSessionColor(info.sessionId) : 'grey.200',
                                            color: filteredSessionId === info.sessionId ? 'white' : getSessionColor(info.sessionId),
                                            boxShadow: 3
                                          }
                                        }}
                                      >
                                        <FilterListIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Timestamp</strong>
                                  <span>{formatLocalDateWithTZ(selectedLog.hook_timestamp, true)}</span>
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
                    {['Basic Information', 'Hook Data'].map((label, index) => (
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
                  {renderTabContent(selectedLog)}
                </Box>
              </Box>

              {/* Raw Toggle at bottom left when closed */}
              {!showRawData && (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'flex-start', 
                  mt: 2, 
                  pt: 2, 
                  borderTop: '1px solid', 
                  borderColor: 'divider' 
                }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showRawData}
                        onChange={handleToggleRawData}
                        size="small"
                        color="primary"
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                        Raw
                      </Typography>
                    }
                    sx={{ 
                      margin: 0,
                      '& .MuiFormControlLabel-label': {
                        marginLeft: 0.5
                      }
                    }}
                  />
                </Box>
              )}

              {/* Raw Data Display */}
              {showRawData && (
                <Box ref={rawDataRef} mt={3}>
                  {/* Raw Toggle at top of raw data when open */}
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'flex-start', 
                    mb: 2, 
                    pb: 1, 
                    borderBottom: '1px solid', 
                    borderColor: 'divider' 
                  }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showRawData}
                          onChange={handleToggleRawData}
                          size="small"
                          color="primary"
                        />
                      }
                      label={
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                          Raw
                        </Typography>
                      }
                      sx={{ 
                        margin: 0,
                        '& .MuiFormControlLabel-label': {
                          marginLeft: 0.5
                        }
                      }}
                    />
                  </Box>
                  <Typography variant="h6" gutterBottom>Raw Data</Typography>
                  <Box 
                    component="pre" 
                    sx={{ 
                      fontSize: '0.75rem', 
                      fontFamily: 'monospace',
                      backgroundColor: 'grey.50',
                      color: 'text.primary',
                      padding: 2,
                      borderRadius: 1,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '50vh',
                      overflow: 'auto',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    {JSON.stringify(selectedLog, null, 2)}
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

export default ClaudeLogsList;
