"use client"

//import PDFViewer from '@/components/PdfViewer';
import { useRouter } from 'next/router'; // Import useRouter

// Dynamic import of PDFViewer component
import dynamic from 'next/dynamic'
const PDFViewer = dynamic(() => import('@/components/PdfViewer'), {
  ssr: false,
})

const PdfViewerPage: React.FC = () => {
  const router = useRouter(); // Use useRouter to access router
  const { id } = router.query; // Get the PDF ID from the URL
  
  if (!id) {
    return <div>No PDF ID provided</div>;
  }

  return (
    <div>
      <h1>PDF Viewer</h1>
      <PDFViewer id={Array.isArray(id) ? id[0] : id} />
    </div>
  );
};

export default PdfViewerPage;
