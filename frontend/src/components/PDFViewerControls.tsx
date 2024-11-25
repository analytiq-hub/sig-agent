import { Box, Button, Tooltip, useTheme } from '@mui/material';

interface PDFViewerControlsProps {
  showLeftPanel: boolean;
  setShowLeftPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showPdfPanel: boolean;
  setShowPdfPanel: React.Dispatch<React.SetStateAction<boolean>>;
}

const PDFViewerControls: React.FC<PDFViewerControlsProps> = ({
  showLeftPanel,
  setShowLeftPanel,
  showPdfPanel,
  setShowPdfPanel,
}) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Tooltip title={showLeftPanel ? "Hide Extraction Panel" : "Show Extraction Panel"}>
        <Button 
          variant="text"
          onClick={() => setShowLeftPanel((prev: boolean) => !prev)}
          sx={{ 
            color: theme.palette.primary.contrastText,
            '&:hover': {
              backgroundColor: theme.palette.primary.light,
              opacity: 0.5,
            },
            backgroundColor: showLeftPanel ? theme.palette.primary.light : 'transparent',
            minWidth: 'auto',
            padding: '6px 12px',
          }}
        >
          Extract
        </Button>
      </Tooltip>
      <Tooltip title={showPdfPanel ? "Hide PDF Panel" : "Show PDF Panel"}>
        <Button 
          variant="text"
          onClick={() => setShowPdfPanel(prev => !prev)}
          sx={{ 
            color: theme.palette.primary.contrastText,
            '&:hover': {
              backgroundColor: theme.palette.primary.light,
              opacity: 0.5,
            },
            backgroundColor: showPdfPanel ? theme.palette.primary.light : 'transparent',
            minWidth: 'auto',
            padding: '6px 12px',
          }}
        >
          PDF
        </Button>
      </Tooltip>
    </Box>
  );
};

export default PDFViewerControls; 