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
  white: '#fff',
  black: '#000000',
};

const theme = createTheme({
  palette: {
    primary: {
      main: websiteColors.mainBlue,
      light: lighten(websiteColors.mainBlue, 0.2),
      dark: darken(websiteColors.mainBlue, 0.2),
      contrastText: websiteColors.white
    },
    secondary: {
      main: websiteColors.accentCoral,
      light: lighten(websiteColors.accentCoral, 0.2),
      dark: darken(websiteColors.accentCoral, 0.2),
      contrastText: websiteColors.white
    },
    pdf_menubar: {
      main: websiteColors.lightGray,
      contrastText: websiteColors.black,
    },
    background: {
      default: websiteColors.white,
      paper: websiteColors.white,
    },
    text: {
      primary: websiteColors.darkBrown,
      secondary: websiteColors.lightGray,
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
