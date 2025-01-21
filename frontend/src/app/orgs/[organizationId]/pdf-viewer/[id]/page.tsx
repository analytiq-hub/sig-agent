"use client"

import dynamic from 'next/dynamic';
import { Box } from '@mui/material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useState, useEffect } from 'react';
import PDFLeftSidebar from '@/components/PDFLeftSidebar';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
})

interface PageProps {
  params: {
    organizationId: string;
    id: string;
  };
}

const PDFViewerPage = ({ params }: PageProps) => {
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

  if (!params.id) return <div>No PDF ID provided</div>;
  const pdfId = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <PanelGroup direction="horizontal" style={{ width: '100%', height: '100%' }}>
          {showLeftPanel && (
            <>
              <Panel defaultSize={panelSizes.left}>
                <Box sx={{ height: '100%', overflow: 'auto' }}>
                  <PDFLeftSidebar organizationId={params.organizationId} id={pdfId} />
                </Box>
              </Panel>
              <PanelResizeHandle style={{ width: '4px', background: '#e0e0e0', cursor: 'col-resize' }} />
            </>
          )}
          
          {showPdfPanel && (
            <Panel defaultSize={panelSizes.main}>
              <Box sx={{ height: '100%', overflow: 'hidden' }}>
                <PDFViewer organizationId={params.organizationId} id={pdfId} />
              </Box>
            </Panel>
          )}
        </PanelGroup>
      </Box>
    </Box>
  );
};

export default PDFViewerPage;
