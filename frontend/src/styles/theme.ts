import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#316EA6', // Blue
      light: '#BDEDFF', // Light blue
      dark: '#3E3736', // Dark brown/gray
    },
    secondary: {
      main: '#E36A70', // Coral/Pink
      light: '#BECEDD', // Light blue/gray
      dark: '#E0E2E5', // Light gray
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        contained: {
          backgroundColor: '#316EA6', // Primary blue
          color: '#fff', // White
          textTransform: 'none',
          '&:hover': {
            backgroundColor: '#285785', // Slightly darker shade of the primary blue
          },
        },
      },
    },
  },
});

export default theme;
