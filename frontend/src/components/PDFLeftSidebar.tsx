import React, { useEffect, useState } from 'react';
import { 
  Box, 
  List, 
  ListItemIcon, 
  ListItemText, 
  Typography, 
  ListItemButton, 
  Toolbar,
  Select,
  MenuItem,
  SelectChangeEvent,
  FormControl
} from '@mui/material';
import { Description } from '@mui/icons-material';
import { getLLMResultApi, getPromptsApi } from '@/utils/api';
import type { Prompt } from '@/utils/api';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const PDFLeftSidebar = ({ id }: { id: string }) => {
  const [llmResults, setLlmResults] = useState<Record<string, Record<string, JsonValue>>>({});
  const [matchingPrompts, setMatchingPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('default');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const promptsResponse = await getPromptsApi({ document_id: id, limit: 100 });
        setMatchingPrompts(promptsResponse.prompts);
        
        // Fetch default prompt results
        const defaultResults = await getLLMResultApi(id);
        setLlmResults(prev => ({
          ...prev,
          default: defaultResults.llm_result
        }));
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  const handlePromptChange = async (event: SelectChangeEvent) => {
    const promptId = event.target.value;
    setSelectedPromptId(promptId);

    // Only fetch if we haven't already fetched this prompt's results
    if (!llmResults[promptId]) {
      try {
        const results = await getLLMResultApi(id, promptId);
        setLlmResults(prev => ({
          ...prev,
          [promptId]: results.llm_result
        }));
      } catch (error) {
        console.error('Error fetching LLM results:', error);
      }
    }
  };

  const currentResults = llmResults[selectedPromptId] || {};

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
          display: 'flex',
          gap: 2,
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
            flexShrink: 0,
          }}
        >
          Select Prompt:
        </Typography>
        <FormControl 
          size="small" 
          sx={{ 
            flexGrow: 1,
            '& .MuiSelect-select': {
              py: 0.5,
              color: theme => theme.palette.pdf_menubar.contrastText,
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255, 255, 255, 0.23)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255, 255, 255, 0.23)',
            },
          }}
        >
          <Select
            value={selectedPromptId}
            onChange={handlePromptChange}
            displayEmpty
          >
            <MenuItem value="default">Default Prompt</MenuItem>
            {matchingPrompts.map((prompt) => (
              <MenuItem key={prompt.id} value={prompt.id}>
                {prompt.name} (v{prompt.version})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Toolbar>

      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        <List>
          {Object.entries(currentResults).map(([key, value]) => (
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
