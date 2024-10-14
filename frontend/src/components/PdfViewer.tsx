// components/PDFViewer.js
"use client"

import { useEffect, useState, useRef } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { downloadFile } from '@/utils/api';
import { Toolbar, Button, Typography } from '@mui/material';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PDFViewer = ({ id }: { id: string }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<string | null>(null);

  // This is a tricky effect hook. It needs to clean up
  // the file URL when the component unmounts. The hook cleanup can be called while
  // the hook is still running, for example, before the axios request completes.
  // We handle this by checking if isMounted is true before setting the file URL.
  useEffect(() => {
    let isMounted = true;
    //console.log('PDF effect running for id:', id);

    const fetchPDF = async () => {
      try {
        //console.log('Fetching PDF for id:', id);
        const response = await downloadFile(id);
        //console.log('PDF download complete for id:', id);
        const blob = new Blob([response], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(blob);
        if (isMounted) {
          setFile(fileURL);
          fileRef.current = fileURL;
          setLoading(false);
          //console.log('PDF loaded successfully for id:', id);
        } else {
          //console.log('Component unmounted before PDF could be set, cleaning up');
          if (fileURL) {
            URL.revokeObjectURL(fileURL);
          }
        }
      } catch (error) {
        console.error('Error fetching PDF for id:', id, error);
        if (isMounted) {
          //setError('Failed to load PDF. Please try again.');
          setLoading(false);
        }
      }
    };

    fetchPDF();

    return () => {
      // The hook cleanup function - called when the component unmounts.
      // It can be called while the hook is still running.
      
      //console.log('PDF effect cleaning up for id:', id);
      isMounted = false;
      if (fileRef.current) {
        URL.revokeObjectURL(fileRef.current);
        //console.log('PDF unloaded from state for id:', id);
      }
      
      setFile(null);
    };
  }, [id]);

  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const handleLoadError = (error: { message: string }) => {
    setError(error.message);
    console.error('PDF Load Error:', error);
  };

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
        <Toolbar sx={{ backgroundColor: theme => theme.palette.primary.main }}>
          <Button onClick={goToPrevPage} disabled={pageNumber <= 1} sx={{ color: theme => theme.palette.secondary.contrastText, backgroundColor: theme => theme.palette.secondary.main }}>
            Prev
          </Button>
          <Typography variant="h6" style={{ flexGrow: 1, textAlign: 'center'}} sx={{ color: theme => theme.palette.secondary.contrastText }}>
            Page {pageNumber} of {numPages}
          </Typography>
          <Button onClick={goToNextPage} disabled={pageNumber >= (numPages || 0)} sx={{ color: theme => theme.palette.secondary.contrastText, backgroundColor: theme => theme.palette.secondary.main }}>
            Next
          </Button>
        </Toolbar>
      <div style={{ overflowY: 'scroll', height: '80vh', padding: '16px' }}>
        {loading ? (
          <div>Loading PDF...</div>
        ) : file ? (
          <Document
            file={file}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <div key={`page_container_${index + 1}`}>
                <Page key={`page_${index + 1}`} pageNumber={index + 1} width={window.innerWidth} />
                {index < numPages! - 1 && <hr style={{ border: '2px solid black' }} />}
              </div>
            ))}
          </Document>
        ) : (
          <div>Error loading PDF.</div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;
