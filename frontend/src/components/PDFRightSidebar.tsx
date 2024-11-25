import React from 'react';
import { Box, Typography } from '@mui/material';

const PDFRightSidebar = ({ id }: { id: string }) => {
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        borderRight: '1px solid rgba(0, 0, 0, 0.12)',
        overflow: 'auto',
      }}
    >
      <Typography variant="h6" sx={{ p: 2 }}>
        OCR {id}
      </Typography>
    </Box>
  );
};

export default PDFRightSidebar;
