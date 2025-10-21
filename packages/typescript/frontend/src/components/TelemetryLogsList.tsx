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
  DialogActions,
  Button,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
    setSelectedLog(log);
    setDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedLog(null);
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

  const columns: GridColDef[] = [
    {
      field: 'timestamp',
      headerName: 'Timestamp',
      width: 180,
      renderCell: (params) => (
        <span className="text-sm">{formatLocalDateWithTZ(params.value, true)}</span>
      )
    },
    {
      field: 'severity',
      headerName: 'Severity',
      width: 100,
      renderCell: (params) => {
        if (!params.value) return '-';
        return (
          <Chip
            label={params.value}
            size="small"
            color={severityColors[params.value] as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' || 'default'}
            sx={{ height: '20px', fontSize: '0.75rem' }}
          />
        );
      }
    },
    {
      field: 'body',
      headerName: 'Message',
      flex: 2,
      minWidth: 300,
      renderCell: (params) => (
        <span className="text-sm truncate">{params.value}</span>
      )
    },
    {
      field: 'trace_id',
      headerName: 'Trace ID',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        params.value ? <span className="font-mono text-xs">{params.value}</span> : '-'
      )
    },
    {
      field: 'tag_ids',
      headerName: 'Tags',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <div className="flex gap-1 flex-wrap py-1">
          {params.value?.map((tagId: string) => (
            <Chip
              key={tagId}
              label={getTagName(tagId)}
              size="small"
              sx={{ height: '20px', fontSize: '0.75rem' }}
            />
          ))}
        </div>
      )
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
        <DialogTitle>Telemetry Log Details</DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box>
              {/* Basic Information */}
              <Box mb={3}>
                <Typography variant="h6" gutterBottom>Basic Information</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Log ID</strong></TableCell>
                        <TableCell>{selectedLog.log_id}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Timestamp</strong></TableCell>
                        <TableCell>{formatLocalDateWithTZ(selectedLog.timestamp, true)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Severity</strong></TableCell>
                        <TableCell>
                          {selectedLog.severity && (
                            <Chip
                              label={selectedLog.severity}
                              size="small"
                              color={severityColors[selectedLog.severity] as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' || 'default'}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Message</strong></TableCell>
                        <TableCell>{selectedLog.body}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Trace ID</strong></TableCell>
                        <TableCell>{selectedLog.trace_id || '-'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Span ID</strong></TableCell>
                        <TableCell>{selectedLog.span_id || '-'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Uploaded By</strong></TableCell>
                        <TableCell>{selectedLog.uploaded_by}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Upload Date</strong></TableCell>
                        <TableCell>{formatLocalDateWithTZ(selectedLog.upload_date, true)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Attributes */}
              {selectedLog.attributes && Object.keys(selectedLog.attributes).length > 0 && (
                <Box mb={3}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6">Attributes</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell><strong>Key</strong></TableCell>
                              <TableCell><strong>Value</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {Object.entries(selectedLog.attributes).map(([key, value]) => (
                              <TableRow key={key}>
                                <TableCell>{key}</TableCell>
                                <TableCell>
                                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}

              {/* Resource */}
              {selectedLog.resource && Object.keys(selectedLog.resource).length > 0 && (
                <Box mb={3}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6">Resource</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell><strong>Key</strong></TableCell>
                              <TableCell><strong>Value</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {Object.entries(parseResourceAttributes(selectedLog.resource)).map(([key, value]) => (
                              <TableRow key={key}>
                                <TableCell>{key}</TableCell>
                                <TableCell>{String(value)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}

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

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <Box mb={3}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6">Metadata</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell><strong>Key</strong></TableCell>
                              <TableCell><strong>Value</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {Object.entries(selectedLog.metadata).map(([key, value]) => (
                              <TableRow key={key}>
                                <TableCell>{key}</TableCell>
                                <TableCell>{value}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetailModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default TelemetryLogsList;
