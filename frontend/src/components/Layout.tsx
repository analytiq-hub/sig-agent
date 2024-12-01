"use client";

import { useState, ReactNode, useEffect } from 'react';

import { styled, useTheme, Theme, CSSObject } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

import { useRouter, usePathname } from 'next/navigation';
import AuthButton from './AuthButton';
import { useSession } from 'next-auth/react';
import UserMenu from './UserMenu'; // Add this import
import Link from 'next/link';
import { Upload as UploadIcon, List as ListIcon, Dashboard as DashboardIcon, Science as ScienceIcon, AccountTree as AccountTreeIcon, Memory as ModelIcon } from '@mui/icons-material';
import { Tooltip } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import PDFViewerControls from '@/components/PDFViewerControls';

// Add this type declaration at the top of the file, after the imports
declare global {
  interface Window {
    pdfViewerControls?: PDFViewerControls;
  }
}

const drawerWidth = 180;

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme }) => ({
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
}));

const authenticatedMenuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, tooltip: 'Dashboard', href: '/dashboard' },
  { text: 'Upload', icon: <UploadIcon />, tooltip: 'Upload', href: '/upload' },
  { text: 'List Files', icon: <ListIcon />, tooltip: 'List Files', href: '/list' },
  { text: 'Models', icon: <ModelIcon />, tooltip: 'Models', href: '/models' },
  { text: 'Flows', icon: <AccountTreeIcon />, tooltip: 'Flows', href: '/flows' },
];

const debugMenuItems = [
  { text: 'Test', icon: <ScienceIcon />, tooltip: 'Test Page', href: '/test' },
];

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    flexShrink: 0,
    whiteSpace: 'nowrap',
    '& .MuiDrawer-paper': {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden',
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
      width: open ? drawerWidth : theme.spacing(7),
      [theme.breakpoints.up('sm')]: {
        width: open ? drawerWidth : theme.spacing(8),
      },
    },
  }),
);

const renderMenuItem = (item: { text: string; icon: JSX.Element; href: string; tooltip: string }, open: boolean) => (
  <Tooltip title={item.tooltip} arrow disableHoverListener={open} placement="right">
    <ListItem 
      key={item.text} 
      component={Link} 
      href={item.href} 
      disablePadding 
    >
      <ListItemButton 
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 48,
        }}
      >
        <ListItemIcon
          sx={{
            display: 'flex',
            justifyContent: 'center',
            minWidth: 0,
            ...(open && { mr: 3 })
          }}
        >
          {item.icon}
        </ListItemIcon>
        {open && <ListItemText primary={item.text} />}
      </ListItemButton>
    </ListItem>
  </Tooltip>
);

interface PDFViewerControls {
  showLeftPanel: boolean;
  setShowLeftPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showPdfPanel: boolean;
  setShowPdfPanel: React.Dispatch<React.SetStateAction<boolean>>;
}

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(!isMobile); // Initialize based on screen size
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isPDFViewer = pathname.startsWith('/pdf-viewer/');
  const [forceUpdate, setForceUpdate] = useState(0);
  const [pdfControls, setPdfControls] = useState<PDFViewerControls | null>(null);

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    const handleControlsChange = () => {
      setForceUpdate(prev => prev + 1);
    };
    
    window.addEventListener('pdfviewercontrols', handleControlsChange);
    return () => window.removeEventListener('pdfviewercontrols', handleControlsChange);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPdfControls(window.pdfViewerControls || null);
    }
  }, [forceUpdate]);

  const handleDrawerToggle = () => {
    setOpen(prev => !prev);
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
    }
  }, [status, router]);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100vh', 
      overflow: 'hidden' 
    }}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              aria-label="toggle drawer"
              onClick={handleDrawerToggle}
              edge="start"
              sx={[
                { marginRight: 5 },
              ]}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              <Link href="/" style={{ color: theme.palette.primary.contrastText, textDecoration: 'none' }}>
                Smart Document Router
              </Link>
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isPDFViewer && pdfControls && (
              <PDFViewerControls key={forceUpdate} {...pdfControls} />
            )}
            {session ? (
              <UserMenu user={session?.user} />
            ) : (
              <AuthButton />
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ 
        display: 'flex',
        position: 'relative',
        flex: 1,
        overflow: 'hidden'
      }}>
        <Drawer variant="permanent" open={open}>
          <Divider />
          <List>
            {status === 'authenticated' && authenticatedMenuItems.map(item => renderMenuItem(item, open))}
          </List>
          <Divider />
          <List>
            {debugMenuItems.map(item => renderMenuItem(item, open))}
          </List>
        </Drawer>
        
        <Box component="main" sx={{ 
          flexGrow: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default Layout;
