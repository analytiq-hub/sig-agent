import React from 'react';
import DataGrid, { Column } from 'react-data-grid';
import { Button } from '@mui/material';

interface File {
  id: string;
  filename: string;
  upload_date: string;
  uploaded_by: string;
}

interface FileListProps {
  files: File[];
  onDownload: (id: string) => void;
}

const FileList: React.FC<FileListProps> = ({ files, onDownload }) => {
  const columns: Column<File>[] = [
    { key: 'filename', name: 'Filename' },
    { key: 'upload_date', name: 'Upload Date' },
    { key: 'uploaded_by', name: 'Uploaded By' },
    {
      key: 'actions',
      name: 'Actions',
      formatter: ({ row }) => (
        <Button variant="contained" size="small" onClick={() => onDownload(row.id)}>
          Download
        </Button>
      ),
    },
  ];

  return (
    <DataGrid columns={columns} rows={files} />
  );
};

export default FileList;