import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  // Customize your theme here
  palette: {
    primary: {
      main: '#2c3e50', // AppBar color
      light: '#4a6b8c', // Lighter shade for hover effects
      dark: '#1a252f', // Darker shade for active states
      contrastText: '#ffffff', // Text color for primary buttons
    },
    secondary: {
      main: '#34495e', // Drawer color
      light: '#4f6272', // Lighter shade for hover effects
      dark: '#1f2a36', // Darker shade for active states
      contrastText: '#ffffff', // Text color for secondary buttons
    },
    error: {
      main: '#e74c3c', // Error color
    },
    warning: {
      main: '#f39c12', // Warning color
    },
    info: {
      main: '#3498db', // Info color
    },
    success: {
      main: '#2ecc71', // Success color
    },
  },
  // Add more customizations as needed
});

export default theme;
