import { Box, Button, Tooltip } from '@mui/material';

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
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Tooltip title={showOcrPanel ? "Hide Extraction Panel" : "Show Extraction Panel"}>
      <Button 
        onClick={() => setShowLeftPanel(!showLeftPanel)}
        sx={{ 
          color: 'white',
          textDecoration: showOcrPanel ? 'underline' : 'none',
        }}
        size="small"
      >
        Extract
      </Button>
      </Tooltip>
      <Button 
        onClick={() => setShowPdfPanel(!showPdfPanel)}
        sx={{ 
          color: 'white',
          textDecoration: showPdfPanel ? 'underline' : 'none',
        }}
        size="small"
      >
        PDF
      </Button>
      <Button 
        onClick={() => setShowOcrPanel(!showOcrPanel)}
        sx={{ 
          color: 'white',
          textDecoration: showOcrPanel ? 'underline' : 'none',
        }}
        size="small"
      >
        OCR
      </Button>
    </Box>
  );
};

export default PDFViewerControls; 