"use client"

//import PDFViewer from '@/components/PdfViewer';
import { useParams } from 'next/navigation'; // Import useParams

// Dynamic import of PDFViewer component
import dynamic from 'next/dynamic'
const PDFViewer = dynamic(() => import('@/components/PdfViewer'), {
  ssr: false,
})

const PdfViewerPage: React.FC = () => {
  const { id } = useParams(); // Get the PDF ID from the URL using useParams
  
  if (!id) {
    return <div>No PDF ID provided</div>;
  }

  return (
        <PDFViewer id={Array.isArray(id) ? id[0] : id} />
  );
};

export default PdfViewerPage;
