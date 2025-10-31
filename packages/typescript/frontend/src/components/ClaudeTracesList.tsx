import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SigAgentOrgApi } from '@/utils/api';
import { getApiErrorMsg } from '@/utils/api';
import { DataGrid, GridColDef, GridFilterInputValueProps } from '@mui/x-data-grid';
import { 
  TextField, 
  InputAdornment, 
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
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { ClaudeLogItem } from '@sigagent/sdk';
import { formatLocalDateWithTZ } from '@/utils/date';

type ClaudeTrace = ClaudeLogItem & {
  hook_data?: {
    session_id?: string;
    transcript_path?: string;
    cwd?: string;
    permission_mode?: string;
    hook_event_name?: string;
    tool_name?: string;
    tool_input?: unknown;
  };
  hook_stdin?: Record<string, unknown>;
  transcript_record?: {
    parentUuid?: string;
    isSidechain?: boolean;
    userType?: string;
    cwd?: string;
    sessionId?: string;
    version?: string;
    gitBranch?: string;
    message?: {
      model?: string;
      id?: string;
      type?: string;
      role?: string;
      content?: unknown[];
      stop_reason?: unknown;
      stop_sequence?: unknown;
      usage?: {
        input_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation?: unknown;
        output_tokens?: number;
        service_tier?: string;
      };
    };
    requestId?: string;
    type?: string;
    uuid?: string;
    timestamp?: string;
  };
};

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

const ClaudeTracesList: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const sigAgentOrgApi = useMemo(() => new SigAgentOrgApi(organizationId), [organizationId]);
  const [traces, setTraces] = useState<ClaudeTrace[]>([]);
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
  const [selectedTrace, setSelectedTrace] = useState<ClaudeTrace | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTraceIndex, setSelectedTraceIndex] = useState<number>(-1);
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
        const response = await sigAgentOrgApi.listClaudeLogs({
          skip: page * pageSize,
          limit: pageSize,
          start_time: startDate || undefined,
          end_time: endDate || undefined,
          session_id: sessionIdFilter || undefined,
          hook_event_name: hookEventNameFilter || undefined,
          tool_name: toolNameFilter || undefined,
          permission_mode: permissionModeFilter || undefined
        });
        setTraces(response.logs);
        setTotal(response.total);
      } catch (error) {
        const errorMsg = getApiErrorMsg(error) || 'Error loading Claude hooks';
        setMessage('Error: ' + errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [page, pageSize, startDate, endDate, sessionIdFilter, hookEventNameFilter, toolNameFilter, permissionModeFilter, sigAgentOrgApi]);

  // Debounced search effect - reset to first page when search parameters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPage(0); // Reset to first page when search changes
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [sessionIdFilter, hookEventNameFilter, toolNameFilter, permissionModeFilter, startDate, endDate]);


  const handleTraceClick = (trace: ClaudeTrace) => {
    const index = filteredTraces.findIndex(t => t.log_id === trace.log_id);
    setSelectedTrace(trace);
    setSelectedTraceIndex(index);
    setDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedTrace(null);
    setSelectedTraceIndex(-1);
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

  const handleNavigateTrace = async (direction: 'prev' | 'next') => {
    if (selectedTraceIndex === -1) return;
    
    const newIndex = direction === 'prev' ? selectedTraceIndex - 1 : selectedTraceIndex + 1;
    
    // Check if we need to load a different page
    if (direction === 'next' && newIndex >= filteredTraces.length) {
      // We're at the end of current page, load next page
      const nextPage = page + 1;
      const totalPages = Math.ceil(total / pageSize);
      
      if (nextPage < totalPages) {
        try {
          setIsLoading(true);
          const response = await sigAgentOrgApi.listClaudeLogs({
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
            setTraces(response.logs);
            setTotal(response.total);
            setSelectedTrace(response.logs[0]);
            setSelectedTraceIndex(0);
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
          const response = await sigAgentOrgApi.listClaudeLogs({
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
            setTraces(response.logs);
            setTotal(response.total);
            const lastIndex = response.logs.length - 1;
            setSelectedTrace(response.logs[lastIndex]);
            setSelectedTraceIndex(lastIndex);
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
    if (newIndex >= 0 && newIndex < filteredTraces.length) {
      const newTrace = filteredTraces[newIndex];
      setSelectedTrace(newTrace);
      setSelectedTraceIndex(newIndex);
      // Keep the same tab selected when navigating
    }
  };

  // Function to render tab content
  const renderTabContent = (trace: ClaudeTrace) => {
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
                        <span className="font-mono text-xs">{trace.log_id}</span>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Organization ID</strong>
                        <span className="font-mono text-xs">{trace.organization_id}</span>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Upload Timestamp</strong>
                        <span>{formatLocalDateWithTZ(trace.upload_timestamp, true)}</span>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Message ID</strong>
                        <span className="font-mono text-xs">{trace.transcript_record?.message?.id || '-'}</span>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'background.default' }}>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Request ID</strong>
                        <span className="font-mono text-xs">{trace.transcript_record?.requestId || '-'}</span>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>UUID</strong>
                        <span className="font-mono text-xs">{trace.transcript_record?.uuid || '-'}</span>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Working Directory</strong>
                        <span className="font-mono text-xs">{trace.hook_data?.cwd || '-'}</span>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <Box display="flex" justifyContent="space-between">
                        <strong>Transcript Path</strong>
                        <span className="font-mono text-xs">{trace.hook_data?.transcript_path || '-'}</span>
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );
      case 1: // Transcript Data
        return (
          <Box>
            {/* Transcript Record Section - Primary focus */}
            {trace.transcript_record && Object.keys(trace.transcript_record).length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom>Transcript Record</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '50%' }}><strong>Key</strong></TableCell>
                        <TableCell sx={{ width: '50%' }}><strong>Value</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(trace.transcript_record).map(([key, value], index) => (
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
              </Box>
            )}

            {/* Hook Data Section - Secondary/de-emphasized */}
            {trace.hook_data && Object.keys(trace.hook_data).length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom color="text.secondary">
                  Hook Data (Metadata)
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ opacity: 0.8 }}>
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '50%' }}><strong>Key</strong></TableCell>
                        <TableCell sx={{ width: '50%' }}><strong>Value</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(trace.hook_data).map(([key, value], index) => (
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
              </Box>
            )}

            {/* Legacy hook_stdin support */}
            {trace.hook_stdin && Object.keys(trace.hook_stdin).length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom color="text.secondary">
                  Hook Stdin (Legacy)
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ opacity: 0.8 }}>
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '50%' }}><strong>Key</strong></TableCell>
                        <TableCell sx={{ width: '50%' }}><strong>Value</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(trace.hook_stdin).map(([key, value], index) => (
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
              </Box>
            )}

            {!trace.transcript_record && !trace.hook_data && !trace.hook_stdin && (
              <Typography color="text.secondary">No transcript data available</Typography>
            )}
          </Box>
        );
      default:
        return null;
    }
  };

  // Helper function to extract salient information from trace data
  const getSalientInfo = (trace: ClaudeTrace) => {
    // Handle new trace structure with transcript_record as primary source
    if (trace.transcript_record) {
      const transcriptRecord = trace.transcript_record;
      const message = transcriptRecord.message;
      
      // Determine message type and role
      const messageType = transcriptRecord.type || 'unknown';
      const role = message?.role || 'unknown';
      let contentType = (message?.content?.[0] as { type?: string })?.type || 'unknown';
      let textContent: string | null = null;
      if (typeof message?.content === 'string') {
        contentType = 'text';
        textContent = message.content;
      } else if (Array.isArray(message?.content) && message.content.length > 0) {
        const firstContent = message.content[0] as { type?: string; text?: string };
        if (firstContent.type === 'text' && firstContent.text) {
          contentType = 'text';
          textContent = firstContent.text;
        }
      }
      
      // Extract tool information from content
      let toolName = '-';
      let toolInput = null;
      let toolResponse = null as unknown | null;
      if (contentType === 'tool_use' && message?.content?.[0]) {
        const toolContent = message.content[0] as { name?: string; input?: unknown };
        toolName = toolContent.name || '-';
        toolInput = toolContent.input || null;
      } else if (contentType === 'tool_result' && message?.content?.[0]) {
        // Tool result messages may not include the tool name in transcript; use hook_data.tool_name as fallback
        const resultContent = message.content[0] as { content?: unknown };
        toolResponse = 'content' in resultContent ? (resultContent.content ?? null) : null;
        toolName = trace.hook_data?.tool_name || '-';
      }
      
      return {
        sessionId: transcriptRecord.sessionId || trace.hook_data?.session_id || '-',
        messageType: messageType,
        role: role,
        contentType: contentType,
        toolName: toolName,
        toolInput: toolInput,
        permissionMode: trace.hook_data?.permission_mode || '-',
        userId: transcriptRecord.userType || '-',
        model: message?.model || '-',
        toolResponse: toolResponse,
        prompt: role === 'user' && textContent ? textContent : null,
        textContent: textContent,
        usage: message?.usage || null,
        messageId: message?.id || '-',
        requestId: transcriptRecord.requestId || '-',
        uuid: transcriptRecord.uuid || '-',
        timestamp: transcriptRecord.timestamp || '-',
        cwd: transcriptRecord.cwd || '-',
        transcriptPath: trace.hook_data?.transcript_path || '-',
        parentUuid: transcriptRecord.parentUuid || '-',
        version: transcriptRecord.version || '-',
        gitBranch: transcriptRecord.gitBranch || '-',
        isSidechain: transcriptRecord.isSidechain || false
      };
    }
    
    // Fallback to old structure for backward compatibility
    const hookData = trace.hook_stdin || {};
    return {
      sessionId: hookData['session_id'] as string || '-',
      messageType: hookData['hook_event_name'] as string || '-',
      role: 'unknown',
      contentType: 'unknown',
      toolName: hookData['tool_name'] as string || '-',
      toolInput: hookData['tool_input'] || null,
      permissionMode: hookData['permission_mode'] as string || '-',
      userId: hookData['user_id'] as string || '-',
      model: hookData['model'] as string || '-',
      toolResponse: hookData['tool_response'] || null,
      prompt: hookData['prompt'] as string || null,
      usage: null,
      messageId: '-',
      requestId: '-',
      uuid: '-',
      timestamp: '-',
      cwd: '-',
      transcriptPath: '-',
      parentUuid: '-',
      version: '-',
      gitBranch: '-',
      isSidechain: false
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

  // Helper function to render todo data as checkboxes
  const renderTodoData = (data: unknown): React.ReactNode | null => {
    try {
      let todoData;
      
      // Handle different data formats
      if (typeof data === 'string') {
        todoData = JSON.parse(data);
      } else if (Array.isArray(data) && data.length === 1 && data[0]?.type === 'text') {
        todoData = JSON.parse(data[0].text);
      } else {
        todoData = data;
      }
      
      // Get the latest todos (prefer newTodos if available, otherwise use todos)
      let todosToRender = [];
      if (todoData && typeof todoData === 'object') {
        if ('newTodos' in todoData && Array.isArray(todoData.newTodos)) {
          todosToRender = todoData.newTodos;
        } else if ('todos' in todoData && Array.isArray(todoData.todos)) {
          todosToRender = todoData.todos;
        }
      }
      
      if (todosToRender.length > 0) {
        return (
          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
            {todosToRender.map((todo: { content: string; status: string; activeForm?: string }, index: number) => {
              const isCompleted = todo.status === 'completed';
              const isInProgress = todo.status === 'in_progress';
              
              return (
                <Box 
                  key={index} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: 1, 
                    mb: 0.5,
                    py: 0.5
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.1, minWidth: '20px' }}>
                    {isCompleted ? (
                      <CheckBoxIcon sx={{ color: 'primary.main', fontSize: '1.1rem' }} />
                    ) : isInProgress ? (
                      <AccessTimeIcon sx={{ color: 'primary.main', fontSize: '1.1rem' }} />
                    ) : (
                      <CheckBoxOutlineBlankIcon sx={{ color: 'primary.main', fontSize: '1.1rem' }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: '0.8rem',
                        color: 'text.primary',
                        lineHeight: 1.3
                      }}
                    >
                      {todo.content}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        );
      }
      
      return null;
    } catch {
      return null;
    }
  };

  // Custom Tooltip component for user prompt information
  const PromptTooltip: React.FC<{ trace: ClaudeTrace; children: React.ReactElement }> = ({ trace, children }) => {
    const info = getSalientInfo(trace);
    
    if (!info.prompt || info.messageType !== 'user') {
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

  // Custom Tooltip component for text message content
  const TextContentTooltip: React.FC<{ content: string; title: string; children: React.ReactElement }> = ({ content, title, children }) => {
    const tooltipContent = (
      <Box sx={{ maxWidth: 400, maxHeight: 300, overflow: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
          {title}
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
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'grey.200',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'grey.400',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'grey.500',
              },
            },
          }}
        >
          {content}
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
  const ToolInfoTooltip: React.FC<{ trace: ClaudeTrace; children: React.ReactElement }> = ({ trace, children }) => {
    const info = getSalientInfo(trace);
    const hasToolData = info.toolInput || info.toolResponse;
    
    if (!hasToolData) {
      return <Tooltip title={info.toolName}>{children}</Tooltip>;
    }

    const tooltipContent = (
      <Box sx={{ maxWidth: 400, maxHeight: 300, overflow: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
          {info.toolName}
        </Typography>
        
        {(() => {
          const renderedInput = renderTodoData(info.toolInput);
          const renderedResponse = renderTodoData(info.toolResponse);
          return info.toolInput && !Boolean(renderedResponse) ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              Input:
            </Typography>
            {Boolean(renderedInput) ? (
              <Box sx={{ marginTop: 0.5 }}>
                {renderedInput}
              </Box>
            ) : (
              <Box 
                component="pre" 
                sx={{ 
                  fontSize: '0.75rem', 
                  fontFamily: 'monospace',
                  backgroundColor: 'primary.light',
                  color: 'text.primary',
                  padding: 1,
                  borderRadius: 1,
                  marginTop: 0.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 120,
                  overflow: 'auto',
                  border: '1px solid',
                  borderColor: 'primary.main',
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: 'primary.light',
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'primary.main',
                    borderRadius: '4px',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                }}
              >
                {typeof info.toolInput === 'string' 
                  ? info.toolInput 
                  : JSON.stringify(info.toolInput, null, 2)
                }
              </Box>
            )}
          </Box>
          ) : null;
        })()}
        
        {Boolean(info.toolResponse) && (() => {
          const renderedResponse = renderTodoData(info.toolResponse);
          return (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                Response:
              </Typography>
              {Boolean(renderedResponse) ? (
                <Box sx={{ marginTop: 0.5 }}>
                  {renderedResponse}
                </Box>
              ) : (
                <Box 
                  component="pre" 
                  sx={{ 
                    fontSize: '0.75rem', 
                    fontFamily: 'monospace',
                    backgroundColor: 'success.light',
                    color: 'text.primary',
                    padding: 1,
                    borderRadius: 1,
                    marginTop: 0.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 120,
                    overflow: 'auto',
                    border: '1px solid',
                    borderColor: 'success.main',
                    '&::-webkit-scrollbar': {
                      width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                      backgroundColor: 'success.light',
                      borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: 'success.main',
                      borderRadius: '4px',
                      '&:hover': {
                        backgroundColor: 'success.dark',
                      },
                    },
                  }}
                >
                  {formatToolResponse(info.toolResponse)}
                </Box>
              )}
            </Box>
          );
        })()}
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

  // Helper function to get icon for message type with color coding
  // Color scheme based on transcript message types:
  // - Purple (#9c27b0): User messages
  // - Blue (#1976d2): Assistant messages
  // - Green (#2e7d32): Tool use messages
  // - Orange (#ed6c02): Tool result messages
  // - Teal (#00acc1): Summary messages
  // - Gray (#757575): Unknown/fallback events
  const getEventIcon = (messageType: string, contentType?: string) => {
    // Handle transcript-based message types
    if (messageType === 'user') {
      if (contentType === 'tool_result') {
        return <BuildIcon fontSize="small" sx={{ color: '#ed6c02' }} />; // Orange for tool results
      }
      return <PersonIcon fontSize="small" sx={{ color: '#9c27b0' }} />; // Purple for user messages
    }
    
    if (messageType === 'assistant') {
      if (contentType === 'tool_use') {
        return <BuildIcon fontSize="small" sx={{ color: '#2e7d32' }} />; // Green for tool use
      }
      return <PsychologyIcon fontSize="small" sx={{ color: '#1976d2' }} />; // Blue for assistant messages
    }
    
    if (messageType === 'summary') {
      return <CompactIcon fontSize="small" sx={{ color: '#00acc1' }} />; // Teal for summary
    }
    
    // Legacy hook-based event handling
    switch (messageType) {
      case 'PreToolUse':
        return <BuildIcon fontSize="small" sx={{ color: '#2e7d32' }} />; // Green wrench for pre-tool execution
      case 'PostToolUse':
        return <BuildIcon fontSize="small" sx={{ color: '#00acc1' }} />; // Teal wrench for post-tool execution
      case 'ToolUse':
        return <BuildIcon fontSize="small" sx={{ color: '#00acc1' }} />; // Teal wrench for combined tool execution
      case 'tool_use':
        return <BuildIcon fontSize="small" sx={{ color: '#2e7d32' }} />; // Green for tool usage (legacy)
      case 'UserPromptSubmit':
        return <PersonIcon fontSize="small" sx={{ color: '#9c27b0' }} />; // Purple for user interaction
      case 'user_prompt':
        return <PersonIcon fontSize="small" sx={{ color: '#9c27b0' }} />; // Purple for user interaction (legacy)
      case 'SessionStart':
        return <LoginIcon fontSize="small" sx={{ color: '#1976d2' }} />; // Blue for session start
      case 'SessionEnd':
        return <LogoutIcon fontSize="small" sx={{ color: '#1976d2' }} />; // Blue for session end
      case 'Stop':
        return <StopIcon fontSize="small" sx={{ color: '#d32f2f' }} />; // Red for stop
      case 'SubagentStop':
        return <SubdirectoryArrowRightIcon fontSize="small" sx={{ color: '#d32f2f' }} />; // Red for subagent stop
      case 'PreCompact':
        return <CompactIcon fontSize="small" sx={{ color: '#ed6c02' }} />; // Orange for compaction
      case 'Notification':
        return <NotificationsIcon fontSize="small" sx={{ color: '#ed6c02' }} />; // Orange for notifications
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
      field: 'upload_timestamp',
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
      field: 'message_type',
      headerName: 'Type',
      width: 140,
      filterable: false,
      sortable: false,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        const icon = getEventIcon(info.messageType, info.contentType);
        const displayText = info.contentType === 'tool_use' ? 'Tool Use' : 
                           info.contentType === 'tool_result' ? 'Tool Result' :
                           info.messageType === 'user' ? 'User' :
                           info.messageType === 'assistant' ? 'Assistant' :
                           info.messageType === 'summary' ? 'Summary' :
                           info.messageType;
        
        return (
          <Box display="flex" alignItems="center" gap={0.5} sx={{ height: '100%', minHeight: '52px', width: '100%' }}>
            {icon}
            <span className="text-sm font-medium">
              {displayText}
            </span>
          </Box>
        );
      }
    },
    {
      field: 'tool_name',
      headerName: 'Tool/Content',
      width: 300,
      filterable: false,
      sortable: false,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        
        // Show tool name for tool_use messages with tooltip sourced from transcript
        if (info.contentType === 'tool_use' && info.toolName !== '-') {
          const displayName = info.toolName.length > 40 ? info.toolName.substring(0, 40) + '...' : info.toolName;
          return (
            <ToolInfoTooltip trace={params.row}>
              <Box sx={{ height: '100%', minHeight: '52px', width: '100%', display: 'flex', alignItems: 'center' }}>
                <span className="text-sm font-mono">
                  {displayName}
                </span>
              </Box>
            </ToolInfoTooltip>
          );
        }
        
        // Show content preview for user text messages with tooltip for full content
        if (info.messageType === 'user' && info.contentType === 'text' && info.textContent) {
          const content = info.textContent;
          const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
          return (
            <TextContentTooltip content={content} title="User Message">
              <Box sx={{ height: '100%', minHeight: '52px', width: '100%', display: 'flex', alignItems: 'center' }}>
                <span className="text-sm">
                  {preview}
                </span>
              </Box>
            </TextContentTooltip>
          );
        }
        
        // Show content preview for assistant text messages with tooltip for full content
        if (info.messageType === 'assistant' && info.contentType === 'text' && info.textContent) {
          const content = info.textContent;
          const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
          return (
            <TextContentTooltip content={content} title="Assistant Message">
              <Box sx={{ height: '100%', minHeight: '52px', width: '100%', display: 'flex', alignItems: 'center' }}>
                <span className="text-sm">
                  {preview}
                </span>
              </Box>
            </TextContentTooltip>
          );
        }
        
        // Show tool result info: display tool name if available, with tooltip
        if (info.contentType === 'tool_result') {
          const displayName = info.toolName && info.toolName !== '-' ? (
            info.toolName.length > 40 ? info.toolName.substring(0, 40) + '...' : info.toolName
          ) : 'Tool Result';
          return (
            <ToolInfoTooltip trace={params.row}>
              <Box sx={{ height: '100%', minHeight: '52px', width: '100%', display: 'flex', alignItems: 'center' }}>
                <span className="text-sm font-mono">
                  {displayName}
                </span>
              </Box>
            </ToolInfoTooltip>
          );
        }
        
        // Show summary info
        if (info.messageType === 'summary') {
          const summary = params.row.transcript_record?.summary || '';
          const preview = summary.length > 50 ? summary.substring(0, 50) + '...' : summary;
          return (
            <Box sx={{ height: '100%', minHeight: '52px', width: '100%', display: 'flex', alignItems: 'center' }}>
              <span className="text-sm">
                {preview}
              </span>
            </Box>
          );
        }
        
        return (
          <Box sx={{ height: '100%', minHeight: '52px', width: '100%', display: 'flex', alignItems: 'center' }}>
            <span className="text-sm text-gray-500">-</span>
          </Box>
        );
      }
    },
    {
      field: 'model',
      headerName: 'Model',
      width: 250,
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
      field: 'usage',
      headerName: 'Usage',
      width: 120,
      filterable: false,
      sortable: false,
      renderCell: (params) => {
        const info = getSalientInfo(params.row);
        if (info.usage) {
          const totalTokens = (info.usage.input_tokens || 0) + (info.usage.output_tokens || 0);
          return (
            <Tooltip title={`Input: ${info.usage.input_tokens || 0}, Output: ${info.usage.output_tokens || 0}`}>
              <span className="text-sm font-mono">
                {totalTokens.toLocaleString()}
              </span>
            </Tooltip>
          );
        }
        return <span className="text-sm">-</span>;
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
        
        // Determine which tooltip to use for the session cell
        const getSessionTooltip = () => {
          if (info.messageType === 'user' && info.prompt) {
            return (
              <PromptTooltip trace={params.row}>
                <Box display="flex" alignItems="center" gap={0.5} sx={{ height: '100%', minHeight: '52px', width: '100%' }}>
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
              </PromptTooltip>
            );
          } else if (info.toolInput || info.toolResponse) {
            return (
              <ToolInfoTooltip trace={params.row}>
                <Box display="flex" alignItems="center" gap={0.5} sx={{ height: '100%', minHeight: '52px', width: '100%' }}>
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
              </ToolInfoTooltip>
            );
          }
          return null;
        };

        const tooltipContent = getSessionTooltip();
        if (tooltipContent) {
          return tooltipContent;
        }

        // Default session cell without tooltip
        return (
          <Box display="flex" alignItems="center" gap={0.5} sx={{ height: '100%', minHeight: '52px', width: '100%' }}>
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


  // Simple filtering for transcript-based traces
  const filteredTraces = useMemo(() => {
    // For now, return all traces as-is since we're focusing on transcript data
    // The filtering logic can be enhanced later based on transcript-specific needs
    return traces;
  }, [traces]);

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
        rows={filteredTraces}
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
        onRowClick={(params) => handleTraceClick(params.row)}
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
            <Typography variant="h6">Claude Trace Details</Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">
                {page * pageSize + selectedTraceIndex + 1} of {total}
              </Typography>
              <Tooltip title="Previous trace">
                <IconButton
                  size="small"
                  onClick={() => handleNavigateTrace('prev')}
                  disabled={page === 0 && selectedTraceIndex <= 0}
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
              <Tooltip title="Next trace">
                <IconButton
                  size="small"
                  onClick={() => handleNavigateTrace('next')}
                  disabled={page * pageSize + selectedTraceIndex >= total - 1}
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
          {selectedTrace && (
            <Box>
              {/* Summary Information */}
              <Box mb={3}>
                <Typography variant="h6" gutterBottom>Summary</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableBody>
                      {(() => {
                        const info = getSalientInfo(selectedTrace);
                        return (
                          <>
                            <TableRow>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Message Type</strong>
                                  <Box display="flex" alignItems="center" gap={0.5}>
                                    {getEventIcon(info.messageType, info.contentType)}
                                    <span>{info.messageType === 'user' ? 'User' : 
                                           info.messageType === 'assistant' ? 'Assistant' :
                                           info.messageType === 'summary' ? 'Summary' :
                                           info.messageType}</span>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" alignItems="flex-start" gap={2}>
                                  <strong style={{ minWidth: '60px', flexShrink: 0 }}>Content</strong>
                                  <span className="font-mono" style={{ wordBreak: 'break-all', lineHeight: '1.4' }}>
                                    {info.contentType === 'tool_use' ? info.toolName :
                                     info.contentType === 'tool_result' ? 'Tool Result' :
                                     info.contentType === 'text' ? 'Text Message' :
                                     info.contentType}
                                  </span>
                                </Box>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Model</strong>
                                  <span className="font-mono">{info.model}</span>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Usage</strong>
                                  <span>
                                    {info.usage ? (
                                      <Tooltip title={`Input: ${info.usage.input_tokens || 0}, Output: ${info.usage.output_tokens || 0}`}>
                                        <span className="font-mono">
                                          {(info.usage.input_tokens || 0) + (info.usage.output_tokens || 0)} tokens
                                        </span>
                                      </Tooltip>
                                    ) : (
                                      <span>-</span>
                                    )}
                                  </span>
                                </Box>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Message ID</strong>
                                  <span className="font-mono text-xs">{info.messageId}</span>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ width: '50%' }}>
                                <Box display="flex" justifyContent="space-between">
                                  <strong>Request ID</strong>
                                  <span className="font-mono text-xs">{info.requestId}</span>
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
                                  <span>{formatLocalDateWithTZ(selectedTrace.upload_timestamp, true)}</span>
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
                    {['Basic Information', 'Transcript Data'].map((label, index) => (
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
                  {renderTabContent(selectedTrace)}
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
                    {JSON.stringify(selectedTrace, null, 2)}
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

export default ClaudeTracesList;
