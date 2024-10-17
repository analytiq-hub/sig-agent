"use client"

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic'
import { Box, IconButton } from '@mui/material';
import PdfSidebar from '@/components/PdfSidebar';
import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import MenuIcon from '@mui/icons-material/Menu';

const PDFViewer = dynamic(() => import('@/components/PdfViewer'), {
  ssr: false,
})

const PdfViewerPage: React.FC = () => {
  const { id } = useParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  if (!id) {
    return <div>No PDF ID provided</div>;
  }

  const pdfId = Array.isArray(id) ? id[0] : id;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <PanelGroup direction="horizontal" style={{ width: '100%', height: '100%' }}>
          {isSidebarOpen && (
            <>
              <Panel defaultSize={25} minSize={20}>
                <Box sx={{ height: '100%', overflow: 'auto' }}>
                  <PdfSidebar id={pdfId} />
                </Box>
              </Panel>
              <PanelResizeHandle style={{ width: '4px', background: '#e0e0e0', cursor: 'col-resize' }} />
            </>
          )}
          <Panel>
            <Box sx={{ height: '100%', overflow: 'auto' }}>
              <PDFViewer id={pdfId} />
            </Box>
          </Panel>
        </PanelGroup>
      </Box>
    </Box>
  );
};

export default PdfViewerPage;
