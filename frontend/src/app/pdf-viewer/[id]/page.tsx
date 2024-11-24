"use client"

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Box, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useState } from 'react';
import PDFLeftSidebar from '@/components/PDFLeftSidebar';

const PDFViewer = dynamic(() => import('@/components/PdfViewer'), {
  ssr: false,
})

const PdfViewerPage: React.FC = () => {
  const { id } = useParams();
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  
  if (!id) return <div>No PDF ID provided</div>;
  const pdfId = Array.isArray(id) ? id[0] : id;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        borderBottom: '1px solid #e0e0e0', 
        p: 0.5 
      }}>
        <IconButton 
          onClick={() => setShowLeftPanel(!showLeftPanel)}
          color={showLeftPanel ? "primary" : "default"}
        >
          <MenuIcon />
        </IconButton>
        <IconButton 
          onClick={() => setShowRightPanel(!showRightPanel)}
          color={showRightPanel ? "primary" : "default"}
        >
          <SettingsIcon />
        </IconButton>
      </Box>

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
          
          <Panel>
            <Box sx={{ height: '100%', overflow: 'hidden' }}>
              <PDFViewer id={pdfId} />
            </Box>
          </Panel>

          {showRightPanel && (
            <>
              <PanelResizeHandle style={{ width: '4px', background: '#e0e0e0', cursor: 'col-resize' }} />
              <Panel defaultSize={20} minSize={15}>
                <Box sx={{ height: '100%', overflow: 'auto', bgcolor: '#f5f5f5' }}>
                  {/* Right panel content */}
                  Right Panel Content
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
