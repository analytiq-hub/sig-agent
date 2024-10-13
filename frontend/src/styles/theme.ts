import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  // Customize your theme here
  palette: {
    primary: {
      main: '#2c3e50', // AppBar color
    },
    secondary: {
      main: '#34495e', // Drawer color
    },
  },
  // Add more customizations as needed
});

export default theme;
