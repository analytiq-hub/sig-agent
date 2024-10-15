import { createTheme, ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary'];
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
  }
}

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
    accent: {
      main: '#f5f5f5', // Toolbar color
      light: '#ffffff', // Lighter shade for hover effects
      dark: '#d7d7d7', // Darker shade for active states
      contrastText: '#000000', // Text color for tertiary buttons
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
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '4px', // Customize border radius if needed
          textTransform: 'none', // Prevent text from being converted to uppercase
        },
        containedPrimary: {
          backgroundColor: '#2c3e50', // Primary button background
          color: '#ffffff', // Primary button text color
          '&:hover': {
            backgroundColor: '#4a6b8c', // Primary button hover background
          },
        },
        outlinedPrimary: {
          color: '#2c3e50', // Primary color
          borderColor: '#2c3e50', // Primary color for border
          '&:hover': {
            backgroundColor: 'rgba(44, 62, 80, 0.04)', // Light primary color background on hover
            borderColor: '#4a6b8c', // Lighter primary color for border on hover
          },
        },
        containedSecondary: {
          backgroundColor: '#34495e', // Secondary button background
          color: '#ffffff', // Secondary button text color
          '&:hover': {
            backgroundColor: '#4f6272', // Secondary button hover background
          },
        },
        outlinedSecondary: {
          color: '#34495e', // Secondary color
          borderColor: '#34495e', // Secondary color for border
          '&:hover': {
            backgroundColor: 'rgba(52, 73, 94, 0.04)', // Light secondary color background on hover
            borderColor: '#4f6272', // Lighter secondary color for border on hover
          },
        },
        containedAccent: {
          backgroundColor: '#f5f5f5', // Accent button background
          color: '#000000', // Accent button text color
          '&:hover': {
            backgroundColor: '#d7d7d7', // Accent button hover background
          },
        },
        outlinedAccent: {
          color: '#f5f5f5', // Accent color
          borderColor: '#f5f5f5', // Accent color for border
          '&:hover': {
            backgroundColor: 'rgba(245, 245, 245, 0.04)', // Light accent color background on hover
            borderColor: '#d7d7d7', // Lighter accent color for border on hover
          },
        },
      },
    },
  },
  // Add more customizations as needed
} as ThemeOptions);

export default theme;
