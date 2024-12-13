import React, { useEffect, useState } from 'react';
import { 
  Box, 
  List, 
  ListItemIcon, 
  ListItemText, 
  Typography, 
  ListItemButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  CircularProgress
} from '@mui/material';
import { Description, ExpandMore, Refresh } from '@mui/icons-material';
import { getLLMResultApi, getPromptsApi, runLLMAnalysisApi } from '@/utils/api';
import type { Prompt } from '@/utils/api';
import { alpha } from '@mui/material/styles';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const PDFLeftSidebar = ({ id }: { id: string }) => {
  const [llmResults, setLlmResults] = useState<Record<string, Record<string, JsonValue>>>({});
  const [matchingPrompts, setMatchingPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('default');
  const [runningPrompts, setRunningPrompts] = useState<Set<string>>(new Set());
  const [expandedPrompt, setExpandedPrompt] = useState<string>('default');

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

  const handlePromptChange = async (promptId: string) => {
    setSelectedPromptId(promptId);
    setExpandedPrompt(promptId);

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

  const renderPromptResults = (promptId: string) => {
    const results = llmResults[promptId] || {};
    return (
      <Box sx={{ 
        backgroundColor: '#FFFFFF',
        pt: 1,
      }}>
        {Object.entries(results).map(([key, value]) => (
          <Box
            key={key}
            sx={{
              px: 2,
              pb: 1.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(0, 0, 0, 0.7)',
                fontSize: '0.7rem',
                display: 'inline-block',
                mb: 0.5,
                textDecoration: 'underline',
                textDecorationColor: 'rgba(0, 0, 0, 0.3)',
                textDecorationThickness: '1px',
                textUnderlineOffset: '2px',
              }}
            >
              {key}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.875rem',
                color: 'text.primary',
                fontWeight: 500,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                pl: 0.5,
              }}
            >
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(0, 0, 0, 0.12)',
        backgroundColor: 'action.hover',
      }}
    >
      <Box sx={{ 
        backgroundColor: theme => theme.palette.pdf_menubar.main,
        borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
        height: '48px',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        px: 1.5,
      }}>
        <Typography
          variant="subtitle2"
          sx={{
            color: theme => theme.palette.pdf_menubar.contrastText,
            fontWeight: 'bold',
          }}
        >
          Available Prompts
        </Typography>
      </Box>

      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        {/* Default Prompt Accordion */}
        <Accordion 
          expanded={expandedPrompt === 'default'}
          onChange={() => handlePromptChange('default')}
          disableGutters
          elevation={0}
          square
          sx={{
            '&:before': { display: 'none' },
            borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
            backgroundColor: 'transparent',
            '& .MuiAccordionSummary-root': {
              backgroundColor: theme => alpha(theme.palette.pdf_menubar.main, 0.1),
              '&:hover': {
                backgroundColor: theme => alpha(theme.palette.pdf_menubar.main, 0.15),
              },
            },
            '& .MuiAccordionDetails-root': {
              p: 0,
              backgroundColor: '#FFFFFF',
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{ 
              minHeight: '48px !important',
              '& .MuiAccordionSummary-content': { my: 0 },
              '& .MuiTypography-root': {
                color: 'text.primary',
              },
              '& .MuiIconButton-root': {
                color: 'text.secondary',
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Typography sx={{ flexGrow: 1, fontSize: '0.875rem' }}>
                Default Prompt
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRunPrompt('default');
                }}
              >
                {runningPrompts.has('default') ? 
                  <CircularProgress size={16} /> : 
                  <Refresh fontSize="small" />}
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {renderPromptResults('default')}
          </AccordionDetails>
        </Accordion>

        {/* Other Prompts */}
        {matchingPrompts.map((prompt) => (
          <Accordion
            key={prompt.id}
            expanded={expandedPrompt === prompt.id}
            onChange={() => handlePromptChange(prompt.id)}
            disableGutters
            elevation={0}
            square
            sx={{
              '&:before': { display: 'none' },
              borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
              backgroundColor: 'transparent',
              '& .MuiAccordionSummary-root': {
                backgroundColor: theme => alpha(theme.palette.pdf_menubar.main, 0.1),
                '&:hover': {
                  backgroundColor: theme => alpha(theme.palette.pdf_menubar.main, 0.15),
                },
              },
              '& .MuiAccordionDetails-root': {
                p: 0,
                backgroundColor: '#FFFFFF',
              },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{ 
                minHeight: '48px !important',
                '& .MuiAccordionSummary-content': { my: 0 },
                '& .MuiTypography-root': {
                  color: 'text.primary',
                },
                '& .MuiIconButton-root': {
                  color: 'text.secondary',
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Typography sx={{ flexGrow: 1, fontSize: '0.875rem' }}>
                  {prompt.name} <Typography component="span" color="text.secondary" fontSize="0.75rem">(v{prompt.version})</Typography>
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunPrompt(prompt.id);
                  }}
                >
                  {runningPrompts.has(prompt.id) ? 
                    <CircularProgress size={16} /> : 
                    <Refresh fontSize="small" />}
                </IconButton>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              {renderPromptResults(prompt.id)}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
};

export default PDFLeftSidebar;
