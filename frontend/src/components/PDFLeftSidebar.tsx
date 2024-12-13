import React, { useEffect, useState } from 'react';
import { Box, List, ListItemIcon, ListItemText, Typography, ListItemButton, Toolbar } from '@mui/material';
import { Description } from '@mui/icons-material';
import { getLLMResultApi, getPromptsApi } from '@/utils/api';
import type { Prompt } from '@/utils/api';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const PDFLeftSidebar = ({ id }: { id: string }) => {
  const [llmResult, setLlmResult] = useState<Record<string, JsonValue>>({});
  const [matchingPrompts, setMatchingPrompts] = useState<Prompt[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [llmResponse, promptsResponse] = await Promise.all([
          getLLMResultApi(id),
          getPromptsApi({ document_id: id, limit: 100 })
        ]);
        setLlmResult(llmResponse.llm_result);
        setMatchingPrompts(promptsResponse.prompts);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (id) {
      fetchData();
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
      {/* Matching Prompts Section */}
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
          Available Prompts
        </Typography>
      </Toolbar>

      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        {/* Prompts List */}
        <List>
          {matchingPrompts.map((prompt) => (
            <ListItemButton key={prompt.id} sx={{ py: 1 }}>
              <ListItemIcon>
                <Description />
              </ListItemIcon>
              <ListItemText 
                primary={prompt.name}
                secondary={`Version ${prompt.version}`}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontSize: '0.875rem',
                  },
                  '& .MuiListItemText-secondary': {
                    fontSize: '0.75rem',
                    color: theme => theme.palette.text.primary,
                    filter: 'brightness(0.9)'
                  }
                }}
              />
            </ListItemButton>
          ))}
        </List>

        {/* LLM Results Section */}
        <Toolbar 
          variant='dense'
          sx={{ 
            backgroundColor: theme => theme.palette.pdf_menubar.main,
            minHeight: '48px !important',
            borderTop: '1px solid rgba(0, 0, 0, 0.12)',
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
            Default Prompt Results
          </Typography>
        </Toolbar>

        {/* LLM Results List */}
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
