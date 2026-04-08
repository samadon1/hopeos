import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Chip,
  Box,
  Container,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Person,
  LocalHospital,
  Science,
  Medication,
  CalendarToday,
  Logout,
  AccountCircle,
  Psychology,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import apiService from '../services/api.service';

interface LayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { text: 'Dashboard', path: '/', icon: <Dashboard /> },
  { text: 'My Profile', path: '/profile', icon: <Person /> },
  { text: 'Medical Records', path: '/records', icon: <LocalHospital /> },
  { text: 'Lab Results', path: '/lab-results', icon: <Science /> },
  { text: 'Medications', path: '/medications', icon: <Medication /> },
  { text: 'Appointments', path: '/appointments', icon: <CalendarToday /> },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { patient, logout } = useAuth();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);

  // AI loading status
  const [aiStatus, setAiStatus] = useState<{
    loading: boolean;
    loaded: boolean;
    error: string | null;
    progress: string;
  }>({ loading: false, loaded: false, error: null, progress: 'Checking...' });

  // Poll AI loading status
  useEffect(() => {
    const checkAiStatus = async () => {
      try {
        const response = await fetch('http://localhost:8080/ai-loading-status');
        const status = await response.json();
        setAiStatus(status);

        // Stop polling once loaded or errored
        if (status.loaded || status.error) {
          return true; // Stop polling
        }
      } catch (error) {
        console.error('[AI Status] Failed to check:', error);
      }
      return false; // Continue polling
    };

    // Initial check
    checkAiStatus();

    // Poll every 2 seconds while loading
    const interval = setInterval(async () => {
      const shouldStop = await checkAiStatus();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleDrawerToggle = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  const handleLogout = async () => {
    handleProfileMenuClose();
    await logout();
    navigate('/login');
  };

  const drawer = (
    <Box sx={{ width: 250 }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Patient Portal
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem
            key={item.text}
            onClick={() => handleNavigation(item.path)}
            sx={{
              cursor: 'pointer',
              backgroundColor: location.pathname === item.path ? 'action.selected' : 'transparent',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: '#0365AC', // OKB brand color
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Avatar
              src="https://pbs.twimg.com/profile_images/1775194896586117120/_bwDwJl2_400x400.jpg"
              alt="OKB Clinic"
              sx={{ mr: 2, width: 32, height: 32 }}
            />
            <Typography variant="h6" noWrap component="div">
              OKB Patient Portal
            </Typography>
          </Box>

          {/* AI Status Indicator */}
          {!isMobile && (
            <Box sx={{ mr: 2 }}>
              {aiStatus.loading && (
                <Chip
                  icon={<CircularProgress size={16} sx={{ color: 'white' }} />}
                  label={aiStatus.progress}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    '& .MuiChip-icon': { color: 'white' }
                  }}
                />
              )}
              {aiStatus.loaded && !aiStatus.loading && (
                <Chip
                  icon={<CheckCircle />}
                  label="AI Ready"
                  size="small"
                  color="success"
                  sx={{ backgroundColor: '#4caf50', color: 'white' }}
                />
              )}
              {aiStatus.error && !aiStatus.loading && (
                <Chip
                  icon={<ErrorIcon />}
                  label="AI Error"
                  size="small"
                  color="error"
                />
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {patient && (
              <Typography variant="body2" sx={{ mr: 2 }}>
                Welcome, {patient.person.preferredName.givenName}
              </Typography>
            )}
            
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="profile-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <AccountCircle />
            </IconButton>
            
            <Menu
              id="profile-menu"
              anchorEl={profileMenuAnchor}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(profileMenuAnchor)}
              onClose={handleProfileMenuClose}
            >
              <MenuItem onClick={() => { handleProfileMenuClose(); handleNavigation('/profile'); }}>
                <Person sx={{ mr: 1 }} /> My Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <Logout sx={{ mr: 1 }} /> Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Desktop Drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: 250,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 250,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileDrawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 250,
            },
          }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - 250px)` },
          mt: '64px', // Height of AppBar
        }}
      >
        <Container maxWidth="lg">
          {children}
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;
