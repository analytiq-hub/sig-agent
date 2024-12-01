import { createTheme, ThemeOptions, darken, lighten } from '@mui/material/styles';

// Extend the default theme type to include pdf_menubar
declare module '@mui/material/styles' {
  interface Palette {
    pdf_menubar: Palette['primary'];
  }
  interface PaletteOptions {
    pdf_menubar: PaletteOptions['primary'];
  }
}

const websiteColors = {
  mainBlue: '#316EA6',
  lightBlue: '#BECEDD',
  accentCoral: '#E36A70',
  backgroundGrey: '#f5f5f5',
  darkBlue: '#285785',
  darkBrown: '#3E3736',
  lightGray: '#f5f5f5',
  whiteText: '#fff',
  blackText: '#000000',
};

const theme = createTheme({
  palette: {
    primary: {
      main: websiteColors.mainBlue,
      light: lighten(websiteColors.lightBlue, 0.2),
      dark: darken(websiteColors.darkBlue, 0.2),
      contrastText: websiteColors.whiteText
    },
    secondary: {
      main: websiteColors.accentCoral,
      light: lighten(websiteColors.lightGray, 0.2),
      dark: darken(websiteColors.lightGray, 0.2),
      contrastText: websiteColors.whiteText
    },
    pdf_menubar: {
      main: websiteColors.lightGray, // Light gray
      contrastText: websiteColors.blackText, // Black text for contrast
    },
    background: {
      default: '#fff', // White
      paper: '#fff', // White
    },
    text: {
      primary: websiteColors.darkBrown, // Dark brown/gray
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
