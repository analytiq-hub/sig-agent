"use client"

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Box } from '@mui/material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useState, useEffect } from 'react';
import PDFLeftSidebar from '@/components/PDFLeftSidebar';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
})

const PDFViewerPage: React.FC = () => {
  const { id } = useParams();
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showPdfPanel, setShowPdfPanel] = useState(true);
  
  useEffect(() => {
    window.pdfViewerControls = {
      showLeftPanel,
      setShowLeftPanel,
      showPdfPanel,
      setShowPdfPanel
    };

    const event = new Event('pdfviewercontrols');
    window.dispatchEvent(event);

    return () => {
      delete window.pdfViewerControls;
    };
  }, [showLeftPanel, showPdfPanel]);

  const getPanelSizes = () => {
    if (!showLeftPanel) {
      return {
        left: 0,
        main: 100
      };
    }

    return {
      left: 40,
      main: 60
    };
  };

  const panelSizes = getPanelSizes();

  if (!id) return <div>No PDF ID provided</div>;
  const pdfId = Array.isArray(id) ? id[0] : id;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <PanelGroup direction="horizontal" style={{ width: '100%', height: '100%' }}>
          {showLeftPanel && (
            <>
              <Panel defaultSize={panelSizes.left}>
                <Box sx={{ height: '100%', overflow: 'auto' }}>
                  <PDFLeftSidebar id={pdfId} />
                </Box>
              </Panel>
              <PanelResizeHandle style={{ width: '4px', background: '#e0e0e0', cursor: 'col-resize' }} />
            </>
          )}
          
          {showPdfPanel && (
            <Panel defaultSize={panelSizes.main}>
              <Box sx={{ height: '100%', overflow: 'hidden' }}>
                <PDFViewer id={pdfId} />
              </Box>
            </Panel>
          )}
        </PanelGroup>
      </Box>
    </Box>
  );
};

export default PDFViewerPage;
