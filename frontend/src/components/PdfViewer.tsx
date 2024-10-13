// components/PDFViewer.js
"use client"

import { useEffect, useState } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { downloadFile } from '@/utils/api';
import { AppBar, Toolbar, Button, Typography } from '@mui/material';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PDFViewer = ({ id }: { id: string }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);

  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const handleLoadError = (error: { message: string }) => {
    setError(error.message);
  };

  useEffect(() => {
    const fetchPDF = async () => {
      try {
        const response = await downloadFile(id);
        const blob = new Blob([response], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(blob);
        setFile(fileURL);
      } catch (error) {
        console.error('Error fetching PDF:', error);
        setError('Failed to load PDF. Please try again.');
      }
    };

    fetchPDF();

    return () => {
      if (file) {
        URL.revokeObjectURL(file);
      }
    };
  }, [id]);

  const goToNextPage = () => {
    if (pageNumber < numPages!) {
      setPageNumber(pageNumber + 1);
    }
  };

  const goToPrevPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  };

  return (
    <div>
      <AppBar position="static">
        <Toolbar>
          <Button onClick={goToPrevPage} disabled={pageNumber <= 1} sx={{ color: 'white' }}>
            Prev
          </Button>
          <Typography variant="h6" style={{ flexGrow: 1, textAlign: 'center', color: 'white' }}>
            Page {pageNumber} of {numPages}
          </Typography>
          <Button onClick={goToNextPage} disabled={pageNumber >= (numPages || 0)} sx={{ color: 'white' }}>
            Next
          </Button>
        </Toolbar>
      </AppBar>
      <div style={{ overflowY: 'scroll', height: '80vh', padding: '16px' }}>
        {error && <div style={{ color: 'red' }}>Error: {error}</div>}
        <Document file={file} onLoadSuccess={handleLoadSuccess} onLoadError={handleLoadError}>
          {Array.from(new Array(numPages), (el, index) => (
            <Page key={`page_${index + 1}`} pageNumber={index + 1} width={window.innerWidth} />
          ))}
        </Document>
      </div>
    </div>
  );
};

export default PDFViewer;
