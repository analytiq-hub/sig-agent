'use client'

import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import { Button, Typography, Box, CircularProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { 
  uploadDocumentsApi,
  listTagsApi
} from '@/utils/api';
import { Tag } from '@/types/index';
import { DocumentWithContent } from '@/types/index';
import { isColorLight } from '@/utils/colors';

interface DocumentUploadProps {
  organizationId: string;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ organizationId }) => {
  const [files, setFiles] = useState<DocumentWithContent[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Fetch available tags on component mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await listTagsApi({ organizationId: organizationId });
        setAvailableTags(response.tags);
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };
    fetchTags();
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const readFiles = acceptedFiles.map(file => 
      new Promise<DocumentWithContent>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            content: reader.result as string,
            tag_ids: selectedTags // Include selected tags with each file
          });
        };
        reader.readAsDataURL(file);
      })
    );

    Promise.all(readFiles).then(setFiles);
  }, [selectedTags]); // Add selectedTags as dependency

  const dropzoneOptions: DropzoneOptions = {
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true,
    // Add these properties to satisfy the DropzoneOptions type
    onDragEnter: () => {},
    onDragOver: () => {},
    onDragLeave: () => {},
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

  const handleUpload = async () => {
    if (files.length === 0) return;

    // Add selected tags to each file before upload
    const filesWithTags = files.map(file => ({
      ...file,
      tag_ids: selectedTags
    }));

    setUploading(true);
    setUploadStatus(null);

    try {
      const response = await uploadDocumentsApi({
        organizationId: organizationId, 
        documents: filesWithTags
      });
      setUploadStatus(`Successfully uploaded ${response.uploaded_documents.length} file(s)`);
      setFiles([]);
      setSelectedTags([]); // Reset selected tags after successful upload
    } catch (error) {
      console.error('Error uploading files:', error);
      setUploadStatus('Error uploading files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ mt: 3, mb: 3 }}>
        <div className="flex items-center gap-4">
          <Typography variant="subtitle1" sx={{ whiteSpace: 'nowrap' }}>
            Select tags for documents:
          </Typography>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => {
                  setSelectedTags(prev => 
                    prev.includes(tag.id)
                      ? prev.filter(id => id !== tag.id)
                      : [...prev, tag.id]
                  )
                }}
                className={`group transition-all ${
                  selectedTags.includes(tag.id)
                    ? 'ring-2 ring-blue-500 ring-offset-2'
                    : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-2'
                }`}
              >
                <div className="flex items-center h-full w-full">
                  <div 
                    className={`px-2 py-1 leading-none rounded shadow-sm flex items-center gap-2 text-sm ${
                      isColorLight(tag.color) ? 'text-gray-800' : 'text-white'
                    }`}
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                    {selectedTags.includes(tag.id) && (
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Box>
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed #cccccc',
          borderRadius: 2,
          p: 3,
          mb: 2,
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: '#f0f0f0'
          }
        }}
      >
        <input {...getInputProps()} accept="application/pdf" />
        <CloudUploadIcon sx={{ fontSize: 48, mb: 2 }} />
        {isDragActive ? (
          <Typography>Drop multiple PDF files here ...</Typography>
        ) : (
          <Typography>Drag multiple PDF files here, or click to select files</Typography>
        )}
      </Box>
      {files.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Selected files:</Typography>
          {files.map((file) => (
            <Typography key={file.name}>{file.name}</Typography>
          ))}
        </Box>
      )}

      <Button
        variant="contained"
        color="primary"
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
        startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </Button>
      
      {uploadStatus && (
        <Typography sx={{ mt: 2 }} color={uploadStatus.includes('Error') ? 'error' : 'success'}>
          {uploadStatus}
        </Typography>
      )}
    </Box>
  );
};

export default DocumentUpload;