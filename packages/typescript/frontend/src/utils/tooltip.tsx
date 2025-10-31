import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// Shared tooltip container styles
export const tooltipContainerStyles = {
  maxWidth: 400,
  backgroundColor: 'grey.100',
  border: '2px solid',
  borderColor: 'grey.400',
  boxShadow: 8
};

// Shared code block styles
export const codeBlockStyles = {
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  backgroundColor: 'grey.100',
  color: 'text.primary',
  padding: 1,
  borderRadius: 1,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflow: 'auto',
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'grey.100',
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'grey.400',
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: 'grey.500',
    },
  },
} as const;

// Helper function to format tool response for display
export const formatToolResponse = (response: unknown): string => {
  if (!response) return '';
  
  // If it's an array with one element of type "text"
  if (Array.isArray(response) && response.length === 1 && response[0]?.type === 'text') {
    const textContent = response[0].text;
    
    // Try to parse as JSON if it looks like stringified JSON
    try {
      const parsed = JSON.parse(textContent);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If not valid JSON, return as-is
      return textContent;
    }
  }
  
  // For other formats, stringify normally
  return typeof response === 'string' ? response : JSON.stringify(response, null, 2);
};

// Helper function to render todo data as checkboxes
export const renderTodoData = (data: unknown): React.ReactNode | null => {
  try {
    let todoData;
    
    // Handle different data formats
    if (typeof data === 'string') {
      todoData = JSON.parse(data);
    } else if (Array.isArray(data) && data.length === 1 && data[0]?.type === 'text') {
      todoData = JSON.parse(data[0].text);
    } else {
      todoData = data;
    }
    
    // Get the latest todos (prefer newTodos if available, otherwise use todos)
    let todosToRender = [];
    if (todoData && typeof todoData === 'object') {
      if ('newTodos' in todoData && Array.isArray(todoData.newTodos)) {
        todosToRender = todoData.newTodos;
      } else if ('todos' in todoData && Array.isArray(todoData.todos)) {
        todosToRender = todoData.todos;
      }
    }
    
    if (todosToRender.length > 0) {
      return (
        <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
          {todosToRender.map((todo: { content: string; status: string; activeForm?: string }, index: number) => {
            const isCompleted = todo.status === 'completed';
            const isInProgress = todo.status === 'in_progress';
            
            return (
              <Box 
                key={index} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 1, 
                  mb: 0.5,
                  py: 0.5
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.1, minWidth: '20px' }}>
                  {isCompleted ? (
                    <CheckBoxIcon sx={{ color: 'primary.main', fontSize: '1.1rem' }} />
                  ) : isInProgress ? (
                    <AccessTimeIcon sx={{ color: 'primary.main', fontSize: '1.1rem' }} />
                  ) : (
                    <CheckBoxOutlineBlankIcon sx={{ color: 'primary.main', fontSize: '1.1rem' }} />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontSize: '0.8rem',
                      color: 'text.primary',
                      lineHeight: 1.3
                    }}
                  >
                    {todo.content}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      );
    }
    
    return null;
  } catch {
    return null;
  }
};

// Type definition for tooltip info
export interface ToolInfo {
  toolName: string;
  toolInput: unknown;
  toolResponse: unknown;
}

// Custom Tooltip component for tool information
export const ToolInfoTooltip: React.FC<{ 
  info: ToolInfo; 
  children: React.ReactElement;
  renderTodoData?: (data: unknown) => React.ReactNode | null;
  formatToolResponse?: (response: unknown) => string;
}> = ({ info, children, renderTodoData: renderTodos = renderTodoData, formatToolResponse: formatResponse = formatToolResponse }) => {
  const hasToolData = info.toolInput || info.toolResponse;
  
  if (!hasToolData) {
    return <Tooltip title={info.toolName}>{children}</Tooltip>;
  }

  const tooltipContent = (
    <Box sx={{ maxWidth: 400, maxHeight: 300, overflow: 'auto' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
        {info.toolName}
      </Typography>
      
      {(() => {
        const renderedInput = renderTodos(info.toolInput);
        const renderedResponse = renderTodos(info.toolResponse);
        return info.toolInput && !Boolean(renderedResponse) ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              Input:
            </Typography>
            {Boolean(renderedInput) ? (
              <Box sx={{ marginTop: 0.5 }}>
                {renderedInput}
              </Box>
            ) : (
              <Box 
                component="pre" 
                sx={{ 
                  ...codeBlockStyles,
                  marginTop: 0.5,
                  maxHeight: 120,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderLeft: '3px solid',
                  borderLeftColor: 'primary.main',
                }}
              >
                {typeof info.toolInput === 'string' 
                  ? info.toolInput 
                  : JSON.stringify(info.toolInput, null, 2)
                }
              </Box>
            )}
          </Box>
        ) : null;
      })()}
      
      {Boolean(info.toolResponse) && (() => {
        const renderedResponse = renderTodos(info.toolResponse);
        return (
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'success.main' }}>
              Response:
            </Typography>
            {Boolean(renderedResponse) ? (
              <Box sx={{ marginTop: 0.5 }}>
                {renderedResponse}
              </Box>
            ) : (
              <Box 
                component="pre" 
                sx={{ 
                  ...codeBlockStyles,
                  marginTop: 0.5,
                  maxHeight: 120,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderLeft: '3px solid',
                  borderLeftColor: 'success.main',
                }}
              >
                {formatResponse(info.toolResponse)}
              </Box>
            )}
          </Box>
        );
      })()}
    </Box>
  );

  return (
    <Tooltip 
      title={tooltipContent}
      placement="right"
      arrow
      componentsProps={{
        tooltip: {
          sx: tooltipContainerStyles
        }
      }}
    >
      {children}
    </Tooltip>
  );
};

// Custom Tooltip component for text message content
export const TextContentTooltip: React.FC<{ 
  content: string; 
  title: string; 
  variant?: 'primary' | 'success'; 
  children: React.ReactElement;
}> = ({ content, title, variant = 'primary', children }) => {
  const isSuccess = variant === 'success';
  const accentColor = isSuccess ? 'success.main' : 'primary.main';

  const tooltipContent = (
    <Box sx={{ maxWidth: 400, maxHeight: 300, overflow: 'auto' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
        {title}
      </Typography>
      <Box 
        component="pre" 
        sx={{ 
          ...codeBlockStyles,
          maxHeight: 200,
          border: '1px solid',
          borderColor: 'divider',
          borderLeft: '3px solid',
          borderLeftColor: accentColor,
        }}
      >
        {content}
      </Box>
    </Box>
  );

  return (
    <Tooltip 
      title={tooltipContent}
      placement="right"
      arrow
      componentsProps={{
        tooltip: {
          sx: tooltipContainerStyles
        }
      }}
    >
      {children}
    </Tooltip>
  );
};

// Custom Tooltip component for user prompt information
export interface PromptInfo {
  prompt: string | null;
}

export const PromptTooltip: React.FC<{ 
  info: PromptInfo;
  children: React.ReactElement;
}> = ({ info, children }) => {
  if (!info.prompt) {
    return <>{children}</>;
  }

  const tooltipContent = (
    <Box sx={{ maxWidth: 400, maxHeight: 300, overflow: 'auto' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
        User Prompt
      </Typography>
      <Box 
        component="pre" 
        sx={{ 
          ...codeBlockStyles,
          maxHeight: 200,
        }}
      >
        {info.prompt}
      </Box>
    </Box>
  );

  return (
    <Tooltip 
      title={tooltipContent}
      placement="right"
      arrow
      componentsProps={{
        tooltip: {
          sx: tooltipContainerStyles
        }
      }}
    >
      {children}
    </Tooltip>
  );
};

