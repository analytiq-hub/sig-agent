import React, { useState } from 'react';
import { TextField, Button, Typography, Box } from '@mui/material';

interface LoginFormProps {
  onLogin: (username: string, password: string) => void;
  onRegister: (username: string, password: string) => void;
  isLoginMode: boolean;
  setIsLoginMode: (isLoginMode: boolean) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, onRegister, isLoginMode, setIsLoginMode }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoginMode) {
      onLogin(username, password);
    } else {
      onRegister(username, password);
    }
  };

  console.log(`isLoginMode: ${isLoginMode}`);

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        id="username"
        label="Username"
        name="username"
        autoComplete="username"
        autoFocus
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="password"
        label="Password"
        type="password"
        id="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
        {isLoginMode ? 'Login' : 'Register'}
      </Button>
      <Typography variant="body2" align="center">
        {isLoginMode ? "Don't have an account? " : "Already have an account? "}
        <Button onClick={() => setIsLoginMode(!isLoginMode)}>
          {isLoginMode ? "Register" : "Login"}
        </Button>
      </Typography>
    </Box>
  );
};

export default LoginForm;