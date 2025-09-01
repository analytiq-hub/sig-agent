import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
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
  const [testRole, setTestRole] = useState<'user' | 'system'>('user');
  const [isTesting, setIsTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<string>('');
  const [testError, setTestError] = useState<string | null>(null);

  const handleRunTest = async () => {
    if (!modelName || !testPrompt.trim()) return;

    setIsTesting(true);
    setTestResponse('');
    setTestError(null);

    try {
      const messages: LLMMessage[] = [
        { role: testRole, content: testPrompt.trim() }
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
          setTestError(error.message);
        }
      );
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'An error occurred during testing');
    } finally {
      setIsTesting(false);
    }
  };

  const handleClose = () => {
    setTestPrompt('Hello, how are you?');
    setTestRole('user');
    setTestResponse('');
    setTestError(null);
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
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Message Role</InputLabel>
            <Select
              value={testRole}
              label="Message Role"
              onChange={(e) => setTestRole(e.target.value as 'user' | 'system')}
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          </FormControl>
          
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
