import React from 'react';
import { Box, Typography } from '@mui/material';

const PDFRightSidebar = ({ id }: { id: string }) => {
  return (
    <Box
      sx={{
        width: '100%', // Set width to 1/3 of the parent container
        height: '100%', // Full viewport height
        borderRight: '1px solid rgba(0, 0, 0, 0.12)', // Add a border on the right side
        overflow: 'auto', // Enable scrolling if content overflows
      }}
    >
      <Typography variant="h6" sx={{ p: 2 }}>
        OCR
      </Typography>
    </Box>
  );
};

export default PDFRightSidebar;
