import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DocRouterOrgApi } from '@/utils/api';
import { getApiErrorMsg } from '@/utils/api';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { 
  TextField, 
  InputAdornment, 
  Chip, 
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
import { Tag, TelemetryMetricResponse } from '@docrouter/sdk';
import { formatLocalDateWithTZ } from '@/utils/date';

type TelemetryMetric = TelemetryMetricResponse;

const TelemetryMetricsList: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const docRouterOrgApi = useMemo(() => new DocRouterOrgApi(organizationId), [organizationId]);
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<TelemetryMetricResponse | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedMetricIndex, setSelectedMetricIndex] = useState<number>(-1);
  const [selectedTab, setSelectedTab] = useState<number>(0);

  const loadMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await docRouterOrgApi.listMetrics({
        skip: page * pageSize,
        limit: pageSize,
        name_search: searchTerm || undefined
      });
      setMetrics(response.metrics);
      setTotal(response.total);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading metrics';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchTerm, docRouterOrgApi]);

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
        await Promise.all([loadMetrics(), loadTags()]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [loadMetrics, loadTags]);

  const getTagName = (tagId: string) => {
    const tag = availableTags.find(t => t.id === tagId);
    return tag?.name || tagId;
  };

  const handleMetricClick = (metric: TelemetryMetric) => {
    const index = metrics.findIndex(m => m.metric_id === metric.metric_id);
    setSelectedMetric(metric);
    setSelectedMetricIndex(index);
    setDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedMetric(null);
    setSelectedMetricIndex(-1);
    setSelectedTab(0);
  };

  const handleNavigateMetric = (direction: 'prev' | 'next') => {
    if (selectedMetricIndex === -1) return;
    
    const newIndex = direction === 'prev' ? selectedMetricIndex - 1 : selectedMetricIndex + 1;
    
    if (newIndex >= 0 && newIndex < metrics.length) {
      const newMetric = metrics[newIndex];
      setSelectedMetric(newMetric);
      setSelectedMetricIndex(newIndex);
    }
  };

  // Function to render tab content
  const renderTabContent = (metric: TelemetryMetricResponse) => {
    switch (selectedTab) {
      case 0: // Basic Information
        return (
          <Box>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" sx={{ tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '50%' }}><strong>Key</strong></TableCell>
                    <TableCell sx={{ width: '50%' }}><strong>Value</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow sx={{ backgroundColor: 'background.default' }}>
                    <TableCell sx={{ width: '50%' }}>Metric Name</TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <span className="font-mono">{metric.name}</span>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ width: '50%' }}>Type</TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <Chip
                        label={metric.type}
                        size="small"
                        color={metric.type === 'counter' ? 'primary' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'background.default' }}>
                    <TableCell sx={{ width: '50%' }}>Data Points</TableCell>
                    <TableCell sx={{ width: '50%' }}>{metric.data_point_count}</TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ width: '50%' }}>Unit</TableCell>
                    <TableCell sx={{ width: '50%' }}>{metric.unit || '-'}</TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'background.default' }}>
                    <TableCell sx={{ width: '50%' }}>Uploaded By</TableCell>
                    <TableCell sx={{ width: '50%' }}>{metric.uploaded_by}</TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ width: '50%' }}>Upload Date</TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      {formatLocalDateWithTZ(metric.upload_date, true)}
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'background.default' }}>
                    <TableCell sx={{ width: '50%' }}>Metric ID</TableCell>
                    <TableCell sx={{ width: '50%' }}>
                      <span className="font-mono text-xs">{metric.metric_id}</span>
                    </TableCell>
                  </TableRow>
                  {metric.description && (
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell sx={{ width: '50%' }}>Description</TableCell>
                      <TableCell sx={{ width: '50%' }}>{metric.description}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );
      case 1: // Data Points
        return (
          <Box>
            {metric.data_points && metric.data_points.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '30%' }}><strong>Timestamp</strong></TableCell>
                      <TableCell sx={{ width: '20%' }}><strong>Value Type</strong></TableCell>
                      <TableCell sx={{ width: '50%' }}><strong>Value</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metric.data_points.map((dataPoint: any, index) => {
                      const timestamp = new Date(parseInt(dataPoint.timeUnixNano) / 1000000);
                      const valueType = dataPoint.value?.asDouble !== undefined ? 'Double' : 
                                      dataPoint.value?.asInt !== undefined ? 'Int' : 'Unknown';
                      const value = dataPoint.value?.asDouble !== undefined ? dataPoint.value.asDouble :
                                   dataPoint.value?.asInt !== undefined ? dataPoint.value.asInt : 'N/A';
                      
                      return (
                        <TableRow 
                          key={index}
                          sx={{ 
                            backgroundColor: index % 2 === 0 ? 'background.default' : 'action.hover' 
                          }}
                        >
                          <TableCell sx={{ width: '30%' }}>
                            <span className="font-mono text-xs">
                              {formatLocalDateWithTZ(timestamp, true)}
                            </span>
                          </TableCell>
                          <TableCell sx={{ width: '20%' }}>
                            <Chip label={valueType} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell sx={{ width: '50%' }}>
                            <span className="font-mono">{value}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No data points available
              </Typography>
            )}
          </Box>
        );
      case 2: // Resource
        return (
          <Box>
            {metric.resource && (metric.resource as any).attributes ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '30%' }}><strong>Key</strong></TableCell>
                      <TableCell sx={{ width: '20%' }}><strong>Value Type</strong></TableCell>
                      <TableCell sx={{ width: '50%' }}><strong>Value</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(metric.resource as any).attributes.map((attr: any, index: number) => {
                      const valueType = attr.value.stringValue !== undefined ? 'String' :
                                      attr.value.boolValue !== undefined ? 'Boolean' :
                                      attr.value.intValue !== undefined ? 'Int' :
                                      attr.value.doubleValue !== undefined ? 'Double' : 'Unknown';
                      const value = attr.value.stringValue !== undefined ? attr.value.stringValue :
                                   attr.value.boolValue !== undefined ? attr.value.boolValue.toString() :
                                   attr.value.intValue !== undefined ? attr.value.intValue.toString() :
                                   attr.value.doubleValue !== undefined ? attr.value.doubleValue.toString() : 'N/A';
                      
                      return (
                        <TableRow 
                          key={index}
                          sx={{ 
                            backgroundColor: index % 2 === 0 ? 'background.default' : 'action.hover' 
                          }}
                        >
                          <TableCell sx={{ width: '30%' }}>
                            <span className="font-mono text-xs">{attr.key}</span>
                          </TableCell>
                          <TableCell sx={{ width: '20%' }}>
                            <Chip label={valueType} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell sx={{ width: '50%' }}>
                            <span className="font-mono text-xs">{value}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No resource information available
              </Typography>
            )}
          </Box>
        );
      case 3: // Metadata
        return (
          <Box>
            {metric.metadata && Object.keys(metric.metadata).length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '50%' }}><strong>Key</strong></TableCell>
                      <TableCell sx={{ width: '50%' }}><strong>Value</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(metric.metadata).map(([key, value], index) => (
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
              <Typography variant="body2" color="text.secondary">
                No metadata available
              </Typography>
            )}
          </Box>
        );
      default:
        return null;
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Metric Name',
      flex: 1,
      minWidth: 250,
      renderCell: (params) => (
        <span className="font-mono text-sm">{params.value}</span>
      )
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'counter' ? 'primary' : 'default'}
          sx={{ height: '20px', fontSize: '0.75rem' }}
        />
      )
    },
    {
      field: 'data_point_count',
      headerName: 'Data Points',
      width: 120,
    },
    {
      field: 'tag_ids',
      headerName: 'Tags',
      flex: 1,
      minWidth: 200,
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
    },
    {
      field: 'upload_date',
      headerName: 'Upload Date',
      width: 180,
      renderCell: (params) => (
        <span className="text-sm">{formatLocalDateWithTZ(params.value, true)}</span>
      )
    },
    {
      field: 'metadata',
      headerName: 'Metadata',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <span className="text-xs text-gray-600">
          {params.value ? Object.keys(params.value).length + ' keys' : '-'}
        </span>
      )
    }
  ];

  return (
    <div className="w-full">
      <div className="mb-4">
        <TextField
          fullWidth
          size="small"
          placeholder="Search metrics by name..."
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
      </div>

      {message && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {message}
        </div>
      )}

      <DataGrid
        rows={metrics}
        columns={columns}
        getRowId={(row) => row.metric_id}
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
        onRowClick={(params) => handleMetricClick(params.row)}
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
            <Typography variant="h6">Telemetry Metric Details</Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">
                {selectedMetricIndex + 1} of {metrics.length}
              </Typography>
              <Tooltip title="Previous metric">
                <IconButton
                  size="small"
                  onClick={() => handleNavigateMetric('prev')}
                  disabled={selectedMetricIndex <= 0}
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
              <Tooltip title="Next metric">
                <IconButton
                  size="small"
                  onClick={() => handleNavigateMetric('next')}
                  disabled={selectedMetricIndex >= metrics.length - 1}
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
          {selectedMetric && (
            <Box>
              {/* Summary Information */}
              <Box mb={3}>
                <Typography variant="h6" gutterBottom>Summary</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ width: '50%' }}>
                          <Box display="flex" justifyContent="space-between">
                            <strong>Metric Name</strong>
                            <span className="font-mono">{selectedMetric.name}</span>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ width: '50%' }}>
                          <Box display="flex" justifyContent="space-between">
                            <strong>Type</strong>
                            <Chip
                              label={selectedMetric.type}
                              size="small"
                              color={selectedMetric.type === 'counter' ? 'primary' : 'default'}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ width: '50%' }}>
                          <Box display="flex" justifyContent="space-between">
                            <strong>Data Points</strong>
                            <span>{selectedMetric.data_point_count}</span>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ width: '50%' }}>
                          <Box display="flex" justifyContent="space-between">
                            <strong>Unit</strong>
                            <span>{selectedMetric.unit || '-'}</span>
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ width: '50%' }}>
                          <Box display="flex" justifyContent="space-between">
                            <strong>Uploaded By</strong>
                            <span>{selectedMetric.uploaded_by}</span>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ width: '50%' }}>
                          <Box display="flex" justifyContent="space-between">
                            <strong>Upload Date</strong>
                            <span>{formatLocalDateWithTZ(selectedMetric.upload_date, true)}</span>
                          </Box>
                        </TableCell>
                      </TableRow>
                      {selectedMetric.description && (
                        <TableRow>
                          <TableCell sx={{ width: '100%' }} colSpan={2}>
                            <Box display="flex" justifyContent="space-between">
                              <strong>Description</strong>
                              <span>{selectedMetric.description}</span>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Tags */}
              {selectedMetric.tag_ids && selectedMetric.tag_ids.length > 0 && (
                <Box mb={3}>
                  <Typography variant="h6" gutterBottom>Tags</Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {selectedMetric.tag_ids.map((tagId) => (
                      <Chip
                        key={tagId}
                        label={getTagName(tagId)}
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Tabs for detailed information */}
              <Box mb={3}>
                {/* Custom tab buttons */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                  <Box display="flex">
                    {['Basic Information', 'Data Points', 'Resource', 'Metadata'].map((label, index) => (
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
                  {renderTabContent(selectedMetric)}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TelemetryMetricsList;
