import React, { useState } from 'react';
import { TextField, Button, Typography, Box } from '@mui/material';

interface AuthFormProps {
  onLogin: (email: string, password: string) => void;
  onRegister: (email: string, password: string, name: string) => void;
  isLoginMode: boolean;
  setIsLoginMode: (isLoginMode: boolean) => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ onLogin, onRegister, isLoginMode, setIsLoginMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoginMode) {
      onLogin(email, password);
    } else {
      onRegister(email, password, name);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
      <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label="Email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
      {!isLoginMode && (
        <TextField
          margin="normal"
          required
          fullWidth
          id="name"
          label="Name"
          name="name"
          autoComplete="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}
      
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

export default AuthForm;