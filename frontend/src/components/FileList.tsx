'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { IconButton } from '@mui/material';
import Link from 'next/link';
import DeleteIcon from '@mui/icons-material/Delete';
import colors from 'tailwindcss/colors';
import { isAxiosError } from 'axios';
import { 
  listDocumentsApi, 
  deleteDocumentApi, 
} from '@/utils/api';
import { DocumentMetadata } from '@/types/index';
import { useOrganization } from '@/contexts/OrganizationContext';

type File = DocumentMetadata;

const FileList: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const [files, setFiles] = useState<File[]>([]);
  const [skipRows, setSkipRows] = useState<number>(0);
  const [countRows, setCountRows] = useState<number>(0);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('Fetching documents...', paginationModel);
      const response = await listDocumentsApi({
        organizationId: "org_unknown",
        skip: paginationModel.page * paginationModel.pageSize,
        limit: paginationModel.pageSize
      });
      console.log('Documents response:', response);
      setFiles(response.documents);  // Changed from pdfs
      setCountRows(response.documents.length);  // Changed from pdfs
      setSkipRows(paginationModel.page * paginationModel.pageSize);
      setTotalRows(response.total_count);
    } catch (error: unknown) {
      console.error('Error fetching documents:', error);
      if (isAxiosError(error) && error.response?.status === 401) {
        // If unauthorized, wait a bit and retry once
        console.log('Unauthorized, waiting for token and retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const retryResponse = await listDocumentsApi({
            organizationId: 'org_unknown',
            skip: paginationModel.page * paginationModel.pageSize,
            limit: paginationModel.pageSize
          }); 
          setFiles(retryResponse.documents);  // Changed from pdfs
          setCountRows(retryResponse.documents.length);  // Changed from pdfs
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
      await deleteDocumentApi(
        {
          organizationId: "org_unknown",
          documentId: fileId
        }
      );
      // Refresh the file list after deletion
      fetchFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      // Optionally, you can add error handling here (e.g., showing an error message)
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'document_name',  // Changed from file_name
      headerName: 'Document Name',  // Updated header
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
    <div className="bg-white p-6 rounded-lg shadow">
      {/* <h2 className="text-xl font-bold mb-4">Document List</h2> */}
    

      {/* Data Grid */}
      <div style={{ height: 400, width: '100%' }}>
        <DataGrid
          loading={isLoading}
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
            '& .MuiDataGrid-cell': {
              padding: '8px',
            },
            '& .MuiDataGrid-row:nth-of-type(odd)': {
              backgroundColor: colors.gray[100],
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: `${colors.gray[200]} !important`,
            },
          }}
        />
      </div>

      {/* Status Text */}
      <div className="mt-4 text-sm text-gray-600">
        {isLoading ? 'Loading...' : 
          totalRows > 0 ? 
            `Showing ${startRange}-${endRange} of ${totalRows} documents` : 
            'No documents found'
        }
      </div>
    </div>
  );
};

export default FileList;
