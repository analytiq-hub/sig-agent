// components/PDFViewer.js
"use client"

import { useEffect, useRef, useState } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PDFViewer = ({ id }: { id: string }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null); // State to hold error messages
  const canvasRef = useRef(null);

  const handleLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleLoadError = (error) => {
    setError(error.message); // Capture the error message
  };

  const [file, setFile] = useState<string | null>(null); // Update type to accept string

  useEffect(() => {
    const fetchPDF = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/download/${id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`, // Assuming you store the token in sessionStorage
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch PDF');
        }

        const blob = await response.blob();
        const fileURL = URL.createObjectURL(blob);
        setFile(fileURL);
      } catch (error) {
        console.error('Error fetching PDF:', error);
        setError('Failed to load PDF. Please try again.');
      }
    };

    fetchPDF();

    // Cleanup function to revoke the object URL
    return () => {
      if (file) {
        URL.revokeObjectURL(file);
      }
    };
  }, [id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const drawRectangle = (e) => {
      // Draw a rectangle based on mouse coordinates
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'red';
      ctx.strokeRect(x, y, 100, 100); // Example: 100x100 rectangle
    };

    canvas.addEventListener('mousedown', drawRectangle);

    return () => {
      canvas.removeEventListener('mousedown', drawRectangle);
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      {error && <div style={{ color: 'red' }}>Error: {error}</div>} {/* Display error message */}
      <Document file={file} onLoadSuccess={handleLoadSuccess} onLoadError={handleLoadError}>
        <Page pageNumber={pageNumber} />
      </Document>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
        width="1000"
        height="1000"
      />
    </div>
  );
};

export default PDFViewer;
