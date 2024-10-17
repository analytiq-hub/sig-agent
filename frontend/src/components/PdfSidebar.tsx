import React from 'react';
import { Box, List, ListItemIcon, ListItemText, Typography, ListItemButton } from '@mui/material';
import { Description, Bookmark, Comment } from '@mui/icons-material';

const PdfSidebar = ({ id }: { id: string }) => {
  return (
    <Box
      sx={{
        width: '33.33%', // Set width to 1/3 of the parent container
        height: '100vh', // Full viewport height
        borderRight: '1px solid rgba(0, 0, 0, 0.12)', // Add a border on the right side
        overflow: 'auto', // Enable scrolling if content overflows
      }}
    >
      <Typography variant="h6" sx={{ p: 2 }}>
        PDF Extractions
      </Typography>
      <List>
        <ListItemButton>
          <ListItemIcon>
            <Description />
          </ListItemIcon>
          <ListItemText primary={`Outline ${id}`} />
        </ListItemButton>
        <ListItemButton>
          <ListItemIcon>
            <Bookmark />
          </ListItemIcon>
          <ListItemText primary="Account" />
        </ListItemButton>
        <ListItemButton>
          <ListItemIcon>
            <Comment />
          </ListItemIcon>
          <ListItemText primary="Items" />
        </ListItemButton>
      </List>
    </Box>
  );
};

export default PdfSidebar;
