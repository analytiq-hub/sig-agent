"use client"

import PDFViewer from '@/components/PdfViewer';
import { useSearchParams } from 'next/navigation';

const PdfViewerPage: React.FC = () => {
  const searchParams = useSearchParams();
  const id = searchParams.get('id'); // Get the PDF ID from the URL
  
  return (
    <div>
      <h1>PDF Viewer</h1>
      <PDFViewer file="/home/andrei/Downloads/Your\ ParkWhiz\ Purchase.pdf" />
    </div>
  );
};

export default PdfViewerPage;
