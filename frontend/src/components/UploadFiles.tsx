import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button, Typography, Box, CircularProgress } from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import axios from 'axios';

const UploadFiles: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const { data: session } = useSession();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post('http://localhost:8000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${session?.apiAccessToken}`
        }
      });
      setUploadStatus(`Successfully uploaded ${response.data.uploaded_files.length} file(s)`);
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
        <input {...getInputProps()} />
        <UploadIcon sx={{ fontSize: 48, mb: 2 }} />
        {isDragActive ? (
          <Typography>Drop the PDF files here ...</Typography>
        ) : (
          <Typography>Drag 'n' drop some PDF files here, or click to select files</Typography>
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
        startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
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

export default UploadFiles;