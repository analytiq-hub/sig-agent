import React, { useState } from 'react';
import { Button, Typography, Box } from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';

interface FileUploadProps {
  onUpload: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUpload }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <Box>
      <input
        accept="application/pdf"
        style={{ display: 'none' }}
        id="raised-button-file"
        type="file"
        onChange={handleFileChange}
      />
      <label htmlFor="raised-button-file">
        <Button variant="contained" component="span" startIcon={<UploadIcon />}>
          Select PDF
        </Button>
      </label>
      {selectedFile && (
        <Typography variant="body1" sx={{ mt: 2 }}>
          Selected file: {selectedFile.name}
        </Typography>
      )}
      <Button
        variant="contained"
        color="primary"
        onClick={handleUpload}
        disabled={!selectedFile}
        sx={{ mt: 2 }}
      >
        Upload
      </Button>
    </Box>
  );
};

export default FileUpload;