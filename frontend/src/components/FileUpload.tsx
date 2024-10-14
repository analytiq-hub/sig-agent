import React, { useCallback, useState } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import { Button, Typography, Box, CircularProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { FileWithContent } from '@/app/types/Api';
import { uploadFilesApi } from '@/utils/api';

const FileUpload: React.FC = () => {
  const [files, setFiles] = useState<FileWithContent[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const readFiles = acceptedFiles.map(file => 
      new Promise<FileWithContent>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            content: reader.result as string
          });
        };
        reader.readAsDataURL(file);
      })
    );

    Promise.all(readFiles).then(setFiles);
  }, []);

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

    setUploading(true);
    setUploadStatus(null);

    try {
      const response = await uploadFilesApi(files);
      setUploadStatus(`Successfully uploaded ${response.uploaded_files.length} file(s)`);
      setFiles([]);
    } catch (error) {
      console.error('Error uploading files:', error);
      setUploadStatus('Error uploading files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ textAlign: 'center' }}>
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

export default FileUpload;