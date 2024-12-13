import React, { useEffect, useState } from 'react';
import { 
  Box, 
  List, 
  ListItemIcon, 
  ListItemText, 
  Typography, 
  ListItemButton,
  Chip,
  CircularProgress
} from '@mui/material';
import { Description, Refresh } from '@mui/icons-material';
import { getLLMResultApi, getPromptsApi, runLLMAnalysisApi } from '@/utils/api';
import type { Prompt } from '@/utils/api';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const PDFLeftSidebar = ({ id }: { id: string }) => {
  const [llmResults, setLlmResults] = useState<Record<string, Record<string, JsonValue>>>({});
  const [matchingPrompts, setMatchingPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('default');
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());

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

  const handlePromptChange = async (newValue: string) => {
    setSelectedPromptId(newValue);

    // Only fetch if we haven't already fetched this prompt's results
    if (!llmResults[newValue]) {
      try {
        const results = await getLLMResultApi(id, newValue);
        setLlmResults(prev => ({
          ...prev,
          [newValue]: results.llm_result
        }));
      } catch (error) {
        console.error('Error fetching LLM results:', error);
      }
    }
  };

  const handleRunPrompt = async (promptId: string) => {
    setRunningPrompts(prev => new Set(prev).add(promptId));
    try {
      await runLLMAnalysisApi(id, promptId, true);
      const results = await getLLMResultApi(id, promptId);
      setLlmResults(prev => ({
        ...prev,
        [promptId]: results.llm_result
      }));
    } catch (error) {
      console.error('Error running prompt:', error);
    } finally {
      setRunningPrompts(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptId);
        return newSet;
      });
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
      <Box sx={{ 
        p: 1.5,
        display: 'flex',
        gap: 1,
        flexWrap: 'wrap',
        backgroundColor: theme => theme.palette.pdf_menubar.main,
        borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
        minHeight: '56px',
        alignItems: 'center'
      }}>
        <Chip
          label="Default Prompt"
          onClick={() => handlePromptChange('default')}
          onDelete={() => handleRunPrompt('default')}
          deleteIcon={runningPrompts.has('default') ? 
            <CircularProgress size={16} color="inherit" /> : 
            <Refresh fontSize="small" />}
          variant={selectedPromptId === 'default' ? 'filled' : 'outlined'}
          color={selectedPromptId === 'default' ? 'primary' : 'default'}
          sx={{
            color: theme => theme.palette.pdf_menubar.contrastText,
            '& .MuiChip-deleteIcon': {
              color: 'inherit'
            },
            '&.MuiChip-outlined': {
              borderColor: 'rgba(255, 255, 255, 0.23)',
            }
          }}
        />
        {matchingPrompts.map((prompt) => (
          <Chip
            key={prompt.id}
            label={`${prompt.name} (v${prompt.version})`}
            onClick={() => handlePromptChange(prompt.id)}
            onDelete={() => handleRunPrompt(prompt.id)}
            deleteIcon={runningPrompts.has(prompt.id) ? 
              <CircularProgress size={16} color="inherit" /> : 
              <Refresh fontSize="small" />}
            variant={selectedPromptId === prompt.id ? 'filled' : 'outlined'}
            color={selectedPromptId === prompt.id ? 'primary' : 'default'}
            sx={{
              color: theme => theme.palette.pdf_menubar.contrastText,
              '& .MuiChip-deleteIcon': {
                color: 'inherit'
              },
              '&.MuiChip-outlined': {
                borderColor: 'rgba(255, 255, 255, 0.23)',
              }
            }}
          />
        ))}
      </Box>

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
