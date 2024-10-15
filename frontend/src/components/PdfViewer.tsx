// components/PDFViewer.js
"use client"

import { useEffect, useState, useRef, useCallback } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { downloadFileApi } from '@/utils/api';
import { Toolbar, Button, Typography, IconButton } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';

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
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  
  // Use a fileRef to store the file URL, which doesn't trigger re-renders when it changes.
  // The cleanup function now uses this ref to revoke the URL.
  //This approach resolves the dependency warning without causing unnecessary re-renders.
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
        const response = await downloadFileApi(id);
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
          setError('Failed to load PDF. Please try again.');
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

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const scrollToPage = useCallback((pageNum: number) => {
    if (pageRefs.current[pageNum - 1]) {
      pageRefs.current[pageNum - 1]?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToPage(pageNumber);
  }, [pageNumber, scrollToPage]);

  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    pageRefs.current = new Array(numPages).fill(null);
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

  const zoomIn = () => setScale(prevScale => Math.min(prevScale + 0.1, 2));
  const zoomOut = () => setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
  const rotateLeft = () => setRotation(prevRotation => (prevRotation - 90) % 360);
  const rotateRight = () => setRotation(prevRotation => (prevRotation + 90) % 360);

  return (
    <div>
      <Toolbar sx={{ backgroundColor: theme => theme.palette.accent.main }}>
        <Button onClick={goToPrevPage} disabled={pageNumber <= 1} variant="outlined">
          Prev
        </Button>
        <Typography variant="h6" style={{ flexGrow: 1, textAlign: 'center'}} sx={{ color: theme => theme.palette.accent.contrastText }}>
          Page {pageNumber} of {numPages}
        </Typography>
        <Button onClick={goToNextPage} disabled={pageNumber >= (numPages || 0)} variant="outlined">
          Next
        </Button>
        <IconButton onClick={zoomOut} color="inherit">
          <ZoomOutIcon />
        </IconButton>
        <IconButton onClick={zoomIn} color="inherit">
          <ZoomInIcon />
        </IconButton>
        <IconButton onClick={rotateLeft} color="inherit">
          <RotateLeftIcon />
        </IconButton>
        <IconButton onClick={rotateRight} color="inherit">
          <RotateRightIcon />
        </IconButton>
      </Toolbar>
      <div style={{ overflowY: 'scroll', height: '80vh', padding: '16px' }}>
        {loading ? (
          <div>Loading PDF...</div>
        ) : error ? (
          <Typography color="error" align="center">
            {error}
          </Typography>
        ) : file ? (
          <Document
            file={file}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <div 
                key={`page_container_${index + 1}`}
                ref={el => pageRefs.current[index] = el}
              >
                <Page 
                  key={`page_${index + 1}`} 
                  pageNumber={index + 1} 
                  width={window.innerWidth * scale} 
                  rotate={rotation}
                />
                {index < numPages! - 1 && <hr style={{ border: '2px solid black' }} />}
              </div>
            ))}
          </Document>
        ) : (
          <Typography color="error" align="center">
            No PDF file available.
          </Typography>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;
