import React, { useEffect, useState } from 'react';
import { Box, List, ListItemIcon, ListItemText, Typography, ListItemButton, Toolbar } from '@mui/material';
import { Description } from '@mui/icons-material';
import { getLLMResultApi } from '@/utils/api';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const PDFLeftSidebar = ({ id }: { id: string }) => {
  const [llmResult, setLlmResult] = useState<Record<string, JsonValue>>({});

  useEffect(() => {
    const fetchLLMResult = async () => {
      try {
        const response = await getLLMResultApi(id);
        setLlmResult(response.llm_result);
      } catch (error) {
        console.error('Error fetching LLM result:', error);
      }
    };

    if (id) {
      fetchLLMResult();
    }
  }, [id]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(0, 0, 0, 0.12)',
      }}
    >
      <Toolbar 
        variant='dense'
        sx={{ 
          backgroundColor: theme => theme.palette.pdf_menubar.main,
          minHeight: '48px !important',
          flexShrink: 0,
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
          padding: '0 16px',
          '& .MuiTypography-root': {
            fontSize: '0.875rem',
          },
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: theme => theme.palette.pdf_menubar.contrastText,
            fontWeight: 'bold',
          }}
        >
          Default Prompt
        </Typography>
      </Toolbar>

      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        <List>
          {Object.entries(llmResult).map(([key, value]) => (
            <ListItemButton key={key}>
              <ListItemIcon>
                <Description />
              </ListItemIcon>
              <ListItemText 
                primary={key}
                secondary={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                sx={{
                  '& .MuiListItemText-secondary': {
                    color: theme => theme.palette.text.primary,
                    filter: 'brightness(0.9)'
                  }
                }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Box>
  );
};

export default PDFLeftSidebar;
