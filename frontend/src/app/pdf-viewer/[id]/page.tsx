"use client"

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Box } from '@mui/material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useState, useEffect } from 'react';
import PDFLeftSidebar from '@/components/PDFLeftSidebar';

const PDFViewer = dynamic(() => import('@/components/PdfViewer'), {
  ssr: false,
})

const PdfViewerPage: React.FC = () => {
  const { id } = useParams();
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showPdfPanel, setShowPdfPanel] = useState(true);
  const [showOcrPanel, setShowOcrPanel] = useState(false);
  
  // Set the controls when the component mounts
  useEffect(() => {
    window.pdfViewerControls = {
      showLeftPanel,
      setShowLeftPanel,
      showPdfPanel,
      setShowPdfPanel,
      showOcrPanel,
      setShowOcrPanel
    };

    // Force a re-render of the Layout's toolbar
    const event = new Event('pdfviewercontrols');
    window.dispatchEvent(event);

    return () => {
      delete window.pdfViewerControls;
    };
  }, [showLeftPanel, showPdfPanel, showOcrPanel]);

  if (!id) return <div>No PDF ID provided</div>;
  const pdfId = Array.isArray(id) ? id[0] : id;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <PanelGroup direction="horizontal" style={{ width: '100%', height: '100%' }}>
          {showLeftPanel && (
            <>
              <Panel defaultSize={20} minSize={15}>
                <Box sx={{ height: '100%', overflow: 'auto' }}>
                  <PDFLeftSidebar id={pdfId} />
                </Box>
              </Panel>
              <PanelResizeHandle style={{ width: '4px', background: '#e0e0e0', cursor: 'col-resize' }} />
            </>
          )}
          
          {showPdfPanel && (
            <Panel>
              <Box sx={{ height: '100%', overflow: 'hidden' }}>
                <PDFViewer id={pdfId} />
              </Box>
            </Panel>
          )}

          {showOcrPanel && (
            <>
              <PanelResizeHandle style={{ width: '4px', background: '#e0e0e0', cursor: 'col-resize' }} />
              <Panel defaultSize={20} minSize={15}>
                <Box sx={{ height: '100%', overflow: 'auto', bgcolor: '#f5f5f5' }}>
                  OCR Panel Content
                </Box>
              </Panel>
            </>
          )}
        </PanelGroup>
      </Box>
    </Box>
  );
};

export default PdfViewerPage;
