'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { Box, IconButton } from '@mui/material';
import { listFilesApi, deleteFileApi, isAxiosError } from '@/utils/api';
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
  const [isLoading, setIsLoading] = useState(true);

  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('Fetching files...', paginationModel);
      const response = await listFilesApi({
        skip: paginationModel.page * paginationModel.pageSize,
        limit: paginationModel.pageSize
      });
      console.log('Files response:', response);
      setFiles(response.pdfs);
      setCountRows(response.pdfs.length);
      setSkipRows(paginationModel.page * paginationModel.pageSize);
      setTotalRows(response.total_count);
    } catch (error: unknown) {
      console.error('Error fetching files:', error);
      if (isAxiosError(error) && error.response?.status === 401) {
        // If unauthorized, wait a bit and retry once
        console.log('Unauthorized, waiting for token and retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const retryResponse = await listFilesApi({
            skip: paginationModel.page * paginationModel.pageSize,
            limit: paginationModel.pageSize
          }); 
          setFiles(retryResponse.pdfs);
          setCountRows(retryResponse.pdfs.length);
          setSkipRows(retryResponse.skip);
          setTotalRows(retryResponse.total_count);
        } catch (retryError) {
          console.error('Retry failed:', retryError);
          setFiles([]);
          setCountRows(0);
          setSkipRows(0);
          setTotalRows(0);
        }
      } else {
        setFiles([]);
        setCountRows(0);
        setSkipRows(0);
        setTotalRows(0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [paginationModel]);

  useEffect(() => {
    console.log('FileList component mounted or pagination changed');
    fetchFiles();
  }, [fetchFiles, paginationModel]);

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
      valueFormatter: (params: GridRenderCellParams) => {
        if (!params.value) return '';
        const date = new Date(params.value as string);
        return date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        });
      },
      renderCell: (params: GridRenderCellParams) => {
        if (!params.value) return '';
        const date = new Date(params.value as string);
        const formattedDate = date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        });
        const tooltip = date.toLocaleString();
        return (
          <div title={tooltip}>
            {formattedDate}
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
        loading={isLoading}
        rows={files}
        columns={columns}
        paginationModel={paginationModel}
        onPaginationModelChange={(newModel) => {
          setPaginationModel(newModel);
        }}
        pageSizeOptions={[5, 10, 25]}
        rowCount={totalRows}
        paginationMode="server"
        disableRowSelectionOnClick
        getRowId={(row) => row.id}
        sx={{
          '& .MuiDataGrid-row:nth-of-type(odd)': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
          },
        }}
      />
      <div>
        {isLoading ? 'Loading...' : 
          totalRows > 0 ? 
            `Showing ${startRange}-${endRange} of ${totalRows} documents` : 
            'No documents found'
        }
      </div>
    </Box>
  );
};

export default FileList;
