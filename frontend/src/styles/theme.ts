import { createTheme, ThemeOptions} from '@mui/material/styles';
import colors from 'tailwindcss/colors'

// Extend the default theme type to include pdf_menubar
declare module '@mui/material/styles' {
  interface Palette {
    pdf_menubar: Palette['primary'];
  }
  interface PaletteOptions {
    pdf_menubar: PaletteOptions['primary'];
  }
}

const theme = createTheme({
  palette: {
    primary: {
      main: colors.blue[600],
      light: colors.blue[400],
      dark: colors.blue[800],
      contrastText: colors.white
    },
    secondary: {
      main: colors.red[400],
      light: colors.red[300],
      dark: colors.red[700],
      contrastText: colors.white
    },
    pdf_menubar: {
      main: colors.gray[100],
      contrastText: colors.black,
    },
    background: {
      default: colors.white,
      paper: colors.gray[100],
    },
    text: {
      primary: colors.stone[700],
      secondary: colors.gray[100],
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
