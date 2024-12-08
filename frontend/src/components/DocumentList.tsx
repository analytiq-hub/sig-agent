'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { Box, IconButton } from '@mui/material';
import { 
  listDocumentsApi, 
  deleteDocumentApi, 
  isAxiosError,
  DocumentMetadata,
  Tag,
  getTagsApi,
  updateDocumentTagsApi
} from '@/utils/api';
import Link from 'next/link';
import DeleteIcon from '@mui/icons-material/Delete';
import { isColorLight } from '@/utils/colors';
import colors from 'tailwindcss/colors';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { DocumentTagEditor } from './DocumentTagEditor';

type File = DocumentMetadata;  // Use type alias instead of interface

const DocumentList: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [skipRows, setSkipRows] = useState<number>(0);
  const [countRows, setCountRows] = useState<number>(0);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [isLoading, setIsLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editingDocument, setEditingDocument] = useState<DocumentMetadata | null>(null);
  const [isTagEditorOpen, setIsTagEditorOpen] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('Fetching documents...', paginationModel);
      const response = await listDocumentsApi({
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

  // Load tags once when component mounts
  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await getTagsApi();
        setTags(response.tags);
      } catch (error) {
        console.error('Error loading tags:', error);
      }
    };
    loadTags();
  }, []);

  // Calculate the current range
  const startRange = skipRows + 1;
  const endRange = Math.min(startRange + countRows - 1, totalRows);

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteDocumentApi(fileId);
      // Refresh the file list after deletion
      fetchFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      // Optionally, you can add error handling here (e.g., showing an error message)
    }
  };

  const handleUpdateTags = async (tagIds: string[]) => {
    if (!editingDocument) return;
    
    try {
      console.log('DocumentList - handleUpdateTags:', {
        documentId: editingDocument.id,
        oldTags: editingDocument.tag_ids,
        newTags: tagIds
      });
      
      await updateDocumentTagsApi(editingDocument.id, tagIds);
      console.log('Tags updated successfully, refreshing document list');
      
      // Refresh the document list to show updated tags
      await fetchFiles();
      console.log('Document list refreshed');
    } catch (error) {
      console.error('Error updating document tags:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      // Log the full error object
      console.error('Full error:', JSON.stringify(error, null, 2));
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
      field: 'tag_ids',
      headerName: 'Tags',
      flex: 1,
      renderCell: (params) => {
        const documentTags = tags.filter(tag => params.row.tag_ids?.includes(tag.id));
        return (
          <div className="flex gap-1 flex-wrap">
            {documentTags.map(tag => {
              const bgColor = tag.color || colors.blue[500];
              const textColor = isColorLight(bgColor) ? 'text-gray-800' : 'text-white';
              return (
                <span
                  key={tag.id}
                  className={`px-2 py-1 rounded text-sm ${textColor}`}
                  style={{ backgroundColor: bgColor }}
                >
                  {tag.name}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: (params) => (
        <div className="flex gap-2">
          <IconButton
            onClick={() => {
              setEditingDocument(params.row);
              setIsTagEditorOpen(true);
            }}
            className="text-blue-600 hover:bg-blue-50"
          >
            <EditOutlinedIcon />
          </IconButton>
          <IconButton
            aria-label="delete"
            onClick={() => handleDeleteFile(params.row.id)}
            className="text-red-600 hover:bg-red-50"
          >
            <DeleteIcon />
          </IconButton>
        </div>
      ),
    },
  ];

  const handleCloseTagEditor = () => {
    setIsTagEditorOpen(false);
    setEditingDocument(null);
  };

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
      
      {editingDocument && (
        <DocumentTagEditor
          isOpen={isTagEditorOpen}
          onClose={handleCloseTagEditor}
          documentName={editingDocument.document_name}
          currentTags={editingDocument.tag_ids || []}
          availableTags={tags}
          onSave={handleUpdateTags}
        />
      )}
    </Box>
  );
};

export default DocumentList;
