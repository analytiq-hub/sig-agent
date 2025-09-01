import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import { runLLMChatStreamApi } from '@/utils/api';
import { LLMChatRequest, LLMMessage } from '@/types/index';

interface LLMTestModalProps {
  open: boolean;
  onClose: () => void;
  modelName: string;
}

const LLMTestModal: React.FC<LLMTestModalProps> = ({ open, onClose, modelName }) => {
  const [testPrompt, setTestPrompt] = useState<string>('Hello, how are you?');
  const [isTesting, setIsTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<string>('');
  const [testError, setTestError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const handleRunTest = async () => {
    if (!modelName || !testPrompt.trim()) return;

    const controller = new AbortController();
    setAbortController(controller);
    setIsTesting(true);
    setTestResponse('');
    setTestError(null);

    try {
      const messages: LLMMessage[] = [
        { role: 'user', content: testPrompt.trim() }
      ];

      const request: LLMChatRequest = {
        model: modelName,
        messages,
        temperature: 0.7,
        stream: true
      };

      await runLLMChatStreamApi(
        request,
        (chunk) => {
          if ('error' in chunk) {
            setTestError(chunk.error);
          } else {
            setTestResponse(prev => prev + chunk.chunk);
          }
        },
        (error) => {
          if (error.name === 'AbortError') {
            setTestError('Request was cancelled');
          } else {
            setTestError(error.message);
          }
        },
        controller.signal
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setTestError('Request was cancelled');
      } else {
        setTestError(error instanceof Error ? error.message : 'An error occurred during testing');
      }
    } finally {
      setIsTesting(false);
      setAbortController(null);
    }
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const handleClose = () => {
    // Cancel any ongoing request
    if (abortController) {
      abortController.abort();
    }
    
    setTestPrompt('Hello, how are you?');
    setTestResponse('');
    setTestError(null);
    setAbortController(null);
    setIsTesting(false);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Test LLM Model: {modelName}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Test Prompt"
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Response:
            </Typography>
            <Box
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                minHeight: 100,
                maxHeight: 300,
                overflow: 'auto',
                backgroundColor: 'grey.50',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap'
              }}
            >
              {isTesting && !testResponse && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2">Testing...</Typography>
                </Box>
              )}
              {testResponse}
              {testError && (
                <Typography color="error" sx={{ mt: 1 }}>
                  Error: {testError}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
        {isTesting && (
          <Button 
            onClick={handleCancel}
            variant="outlined"
            color="error"
          >
            Cancel
          </Button>
        )}
        <Button 
          onClick={handleRunTest}
          variant="contained"
          disabled={isTesting || !testPrompt.trim()}
        >
          {isTesting ? 'Testing...' : 'Run Test'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LLMTestModal;
