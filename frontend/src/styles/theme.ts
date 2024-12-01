import { createTheme, ThemeOptions } from '@mui/material/styles';

// Extend the default theme type to include accent
declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary'];
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
  }
}

const theme = createTheme({
  palette: {
    primary: {
      main: '#316EA6', // Blue
      light: '#BECEDD', // Light blue
      dark: '#285785', // Darker blue for hover states
      contrastText: '#fff', // White text for contrast
    },
    secondary: {
      main: '#E36A70', // Coral/Pink
      light: '#BECEDD', // Light blue/gray
      dark: '#E0E2E5', // Light gray
      contrastText: '#fff', // White text for contrast
    },
    accent: {
      main: '#f5f5f5', // Light gray
      light: '#ffffff', // White
      dark: '#d7d7d7', // Gray
      contrastText: '#000000', // Black text for contrast
    },
    background: {
      default: '#fff', // White
      paper: '#fff', // White
    },
    text: {
      primary: '#3E3736', // Dark brown/gray
      secondary: '#666666', // Gray
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        contained: {
          textTransform: 'none',
        },
      },
    },
  },
} as ThemeOptions);

export default theme;
