// components/PDFViewer.js
import { useEffect, useRef, useState } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFViewer = ({ file }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const canvasRef = useRef(null);

  const handleLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

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
      <Document file={file} onLoadSuccess={handleLoadSuccess}>
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
