"use client"

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic'
import { Box } from '@mui/material';
import PDFSidebar from '@/components/PDFSidebar';

const PDFViewer = dynamic(() => import('@/components/PdfViewer'), {
  ssr: false,
})

const PdfViewerPage: React.FC = () => {
  const { id } = useParams();
  
  if (!id) {
    return <div>No PDF ID provided</div>;
  }

  const pdfId = Array.isArray(id) ? id[0] : id;

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <PDFSidebar pdfId={pdfId} />
      <Box sx={{ flexGrow: 1, width: '66.67%', overflow: 'auto' }}>
        <PDFViewer id={pdfId} />
      </Box>
    </Box>
  );
};

export default PdfViewerPage;
