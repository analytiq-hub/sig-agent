import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DocRouterOrgApi } from '@/utils/api';
import { getApiErrorMsg } from '@/utils/api';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { TextField, InputAdornment, Chip, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Tag } from '@docrouter/sdk';

interface TelemetryLog {
  log_id: string;
  timestamp: string;
  severity?: string;
  body: string;
  trace_id?: string;
  span_id?: string;
  tag_ids: string[];
  metadata?: Record<string, string>;
}

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

  const columns: GridColDef[] = [
    {
      field: 'timestamp',
      headerName: 'Timestamp',
      width: 180,
      renderCell: (params) => (
        <span className="text-sm">{new Date(params.value).toLocaleString()}</span>
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
            color={severityColors[params.value] as any || 'default'}
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
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
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

export default TelemetryLogsList;
