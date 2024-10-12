"use client"

//import PDFViewer from '@/components/PdfViewer';
import { useSearchParams } from 'next/navigation';

// Dynamic import of PDFViewer component
import dynamic from 'next/dynamic'
 const PDFViewer = dynamic(() => import('@/components/PdfViewer'), {
  ssr: false,
})

const PdfViewerPage: React.FC = () => {
  const searchParams = useSearchParams();
  const id = searchParams.get('id'); // Get the PDF ID from the URL
  
  return (
    <div>
      <h1>PDF Viewer</h1>
      <PDFViewer file="/SummaryBillApr2024.pdf" />
    </div>
  );
};

export default PdfViewerPage;
