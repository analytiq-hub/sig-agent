import { Box, Button, Tooltip, useTheme } from '@mui/material';
import { useEffect } from 'react';

interface PDFViewerControlsProps {
  showLeftPanel: boolean;
  setShowLeftPanel: (show: boolean) => void;
  showPdfPanel: boolean;
  setShowPdfPanel: (show: boolean) => void;
  showOcrPanel: boolean;
  setShowOcrPanel: (show: boolean) => void;
}

const PDFViewerControls: React.FC<PDFViewerControlsProps> = ({
  showLeftPanel,
  setShowLeftPanel,
  showPdfPanel,
  setShowPdfPanel,
  showOcrPanel,
  setShowOcrPanel,
}) => {
  const theme = useTheme();
  
  useEffect(() => {
    console.log('showLeftPanel changed:', showLeftPanel);
  }, [showLeftPanel]);
  
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Tooltip title={showLeftPanel ? "Hide Extraction Panel" : "Show Extraction Panel"}>
        <Button 
          variant="text"
          onClick={() => setShowLeftPanel(prev => !prev)}
          sx={{ 
            color: theme.palette.primary.contrastText,
            '&:hover': {
              backgroundColor: theme.palette.primary.light,
              opacity: 0.8,
            },
            backgroundColor: showLeftPanel 
              ? theme.palette.primary.light 
              : 'transparent',
            minWidth: 'auto',
            padding: '6px 12px',
          }}
        >
          Extract
        </Button>
      </Tooltip>
      <Button 
        variant="text"
        onClick={() => setShowPdfPanel(!showPdfPanel)}
        sx={{ 
          color: theme.palette.primary.contrastText,
          '&:hover': {
            backgroundColor: theme.palette.primary.light,
            opacity: 0.8,
          },
          backgroundColor: showPdfPanel ? theme.palette.primary.light : 'transparent',
          minWidth: 'auto',
          padding: '6px 12px',
        }}
      >
        PDF
      </Button>
      <Button 
        variant="text"
        onClick={() => setShowOcrPanel(!showOcrPanel)}
        sx={{ 
          color: theme.palette.primary.contrastText,
          '&:hover': {
            backgroundColor: theme.palette.primary.light,
            opacity: 0.8,
          },
          backgroundColor: showOcrPanel ? theme.palette.primary.light : 'transparent',
          minWidth: 'auto',
          padding: '6px 12px',
        }}
      >
        OCR
      </Button>
    </Box>
  );
};

export default PDFViewerControls; 