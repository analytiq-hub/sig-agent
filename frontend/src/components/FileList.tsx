'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, IconButton } from '@mui/material';
import { listFilesApi, deleteFileApi } from '@/utils/api';
import Link from 'next/link';
import DeleteIcon from '@mui/icons-material/Delete';

interface File {
  id: string;
  file_name: string;
  upload_date: string;
  uploaded_by: string;
  state: string;
}

const FileList: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [skipRows, setSkipRows] = useState<number>(0);
  const [countRows, setCountRows] = useState<number>(0);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  const fetchFiles = useCallback(async () => {
    try {
      const response = await listFilesApi();
      setFiles(response.pdfs);
      setCountRows(response.pdfs.length);
      setSkipRows(response.skip);
      setTotalRows(response.total_count);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Calculate the current range
  const startRange = skipRows + 1;
  const endRange = Math.min(startRange + countRows - 1, totalRows);

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteFileApi(fileId);
      // Refresh the file list after deletion
      fetchFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      // Optionally, you can add error handling here (e.g., showing an error message)
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'file_name',
      headerName: 'Filename',
      flex: 1,
      renderCell: (params) => {
        return (
          <Link href={`/pdf-viewer/${params.row.id}`}
            style={{ color: 'blue', textDecoration: 'underline' }}>
            {params.value}
          </Link>
        );
      },
    },
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
    { field: 'state', headerName: 'State', flex: 1 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      renderCell: (params) => (
        <IconButton
          aria-label="delete"
          onClick={() => handleDeleteFile(params.row.id)}
        >
          <DeleteIcon />
        </IconButton>
      ),
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
