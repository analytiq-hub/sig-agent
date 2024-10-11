'use client'

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { AppSession } from '@/app/types/AppSession';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box } from '@mui/material';

interface File {
  id: string;
  filename: string;
  upload_date: string;
  uploaded_by: string;
  retrieved_by: string[];
}

interface ListPDFsResponse {
  pdfs: File[];
  total_count: number;
  skip: number;
}

const FileList: React.FC = () => {
  const { data: session } = useSession() as { data: AppSession | null };
  const [files, setFiles] = useState<File[]>([]);
  const [skipRows, setSkipRows] = useState<number>(0);
  const [countRows, setCountRows] = useState<number>(0);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  const fetchFiles = useCallback(async () => {
    try {
      if (session?.apiAccessToken) {
        const response = await axios.get<ListPDFsResponse>(
          `http://localhost:8000/list?skip=${paginationModel.page * paginationModel.pageSize}&limit=${paginationModel.pageSize}`,
          {
            headers: { Authorization: `Bearer ${session.apiAccessToken}` }
          }
        );

        setFiles(response.data.pdfs);
        setCountRows(response.data.pdfs.length);
        setSkipRows(response.data.skip);
        setTotalRows(response.data.total_count);
      } else {
        console.error('No API access token available');
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  }, [paginationModel.page, paginationModel.pageSize, session?.apiAccessToken]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Calculate the current range
  const startRange = skipRows + 1;
  const endRange = Math.min(startRange + countRows - 1, totalRows);

  const columns: GridColDef[] = [
    { field: 'filename', headerName: 'Filename', flex: 1 },
    {
      field: 'upload_date',
      headerName: 'Upload Date',
      flex: 1,
      valueGetter: (params: string) => {
        const date = params ? new Date(params) : null;
        return date ? {
          value: date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          tooltip: date.toLocaleString()
        } : '';
      },
      renderCell: (params) => {
        const { value, tooltip } = params.value;
        return (
          <div title={tooltip}>
            {value}
          </div>
        );
      },
    },
    { field: 'uploaded_by', headerName: 'Uploaded By', flex: 1 },
    {
      field: 'retrieved_by',
      headerName: 'Retrieved By',
      flex: 1,
      valueGetter: (params: { row?: { retrieved_by?: string[] } }) =>
        params.row && Array.isArray(params.row['retrieved_by'])
          ? params.row['retrieved_by'].join(', ')
          : '',
    },
  ];

  return (
    <Box sx={{ height: 400, width: '100%' }}>
      <DataGrid
        rows={files}
        columns={columns}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[5, 10, 25]}
        rowCount={totalRows}
        paginationMode="server"
        disableRowSelectionOnClick
        getRowId={(row) => row.id}
        sx={{
          '& .MuiDataGrid-row:nth-of-type(odd)': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)', // Zebra stripe color
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.1)', // Darker gray for hover
          },
        }}
      />
      <div>
        {totalRows > 0 ? `Showing ${startRange}-${endRange} of ${totalRows} documents` : 'No documents found'}
      </div>
    </Box>
  );
};

export default FileList;
