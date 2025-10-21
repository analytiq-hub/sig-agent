import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DocRouterOrgApi } from '@/utils/api';
import { getApiErrorMsg } from '@/utils/api';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { TextField, InputAdornment, Chip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Tag } from '@docrouter/sdk';
import { formatLocalDateWithTZ } from '@/utils/date';

interface TelemetryMetric {
  metric_id: string;
  name: string;
  type: string;
  data_point_count: number;
  tag_ids: string[];
  metadata?: Record<string, string>;
  upload_date: string;
}

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
        autoHeight
        sx={{
          '& .MuiDataGrid-cell': {
            padding: '8px',
          }
        }}
      />
    </div>
  );
};

export default TelemetryMetricsList;
