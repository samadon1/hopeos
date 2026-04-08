
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, CircularProgress, Box } from '@mui/material';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';

// Lazy load all page components for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const OTPLogin = lazy(() => import('./pages/OTPLogin'));
const SimpleDashboard = lazy(() => import('./pages/SimpleDashboard'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminPortal = lazy(() => import('./pages/AdminPortal'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminPatientPortalView = lazy(() => import('./pages/AdminPatientPortalView'));
const DiagnosticPage = lazy(() => import('./components/admin/DiagnosticPage'));
const NurseDashboard = lazy(() => import('./pages/NurseDashboard'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const RegistrarDashboard = lazy(() => import('./pages/RegistrarDashboard'));
const PharmacyDashboard = lazy(() => import('./pages/PharmacyDashboard'));
const LabDashboard = lazy(() => import('./pages/LabDashboard'));

// Loading fallback component
const PageLoader = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
    bgcolor="#f8fafc"
  >
    <CircularProgress size={40} />
  </Box>
);

// Modern color palette
const modernColors = {
  primary: {
    main: '#667eea',
    light: '#8a9eff',
    dark: '#4a5fd8',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  secondary: {
    main: '#764ba2',
    light: '#9a6fc7',
    dark: '#5a3d7a',
  },
  success: {
    main: '#42be65',
    light: '#6fdc8c',
    dark: '#24a148',
  },
  warning: {
    main: '#f1c21b',
    light: '#f4d03f',
    dark: '#d4a106',
  },
  error: {
    main: '#fa4d56',
    light: '#ff8389',
    dark: '#da1e28',
  },
  info: {
    main: '#4facfe',
    light: '#00f2fe',
    dark: '#3a8bfe',
  },
  background: {
    default: '#f8fafc',
    paper: '#ffffff',
    gradient: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  },
  text: {
    primary: '#1a202c',
    secondary: '#4a5568',
  },
  grey: {
    50: '#f7fafc',
    100: '#edf2f7',
    200: '#e2e8f0',
    300: '#cbd5e0',
    400: '#a0aec0',
    500: '#718096',
    600: '#4a5568',
    700: '#2d3748',
    800: '#1a202c',
    900: '#171923',
  },
};

// Create modern theme
const theme = createTheme({
  palette: {
    primary: {
      main: modernColors.primary.main,
      light: modernColors.primary.light,
      dark: modernColors.primary.dark,
      contrastText: '#ffffff',
    },
    secondary: {
      main: modernColors.secondary.main,
      light: modernColors.secondary.light,
      dark: modernColors.secondary.dark,
    },
    success: {
      main: modernColors.success.main,
      light: modernColors.success.light,
      dark: modernColors.success.dark,
    },
    warning: {
      main: modernColors.warning.main,
      light: modernColors.warning.light,
      dark: modernColors.warning.dark,
    },
    error: {
      main: modernColors.error.main,
      light: modernColors.error.light,
      dark: modernColors.error.dark,
    },
    info: {
      main: modernColors.info.main,
      light: modernColors.info.light,
      dark: modernColors.info.dark,
    },
    background: {
      default: modernColors.background.default,
      paper: modernColors.background.paper,
    },
    text: {
      primary: modernColors.text.primary,
      secondary: modernColors.text.secondary,
    },
    grey: modernColors.grey,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '3rem',
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      fontSize: '2.5rem',
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 700,
      fontSize: '2rem',
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      letterSpacing: 0,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      letterSpacing: 0,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
      fontSize: '1rem',
      lineHeight: 1.5,
      letterSpacing: 0,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
      letterSpacing: 0,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          borderRadius: 16,
          overflow: 'hidden',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 600,
          textTransform: 'none',
          boxShadow: 'none',
          minHeight: '48px',
          padding: '12px 24px',
          fontSize: '1rem',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transform: 'translateY(-1px)',
          },
          transition: 'all 0.2s ease-in-out',
        },
        contained: {
          background: modernColors.primary.gradient,
          color: '#ffffff',
          '&:hover': {
            background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
          },
        },
        outlined: {
          borderColor: modernColors.primary.main,
          color: modernColors.primary.main,
          borderWidth: '2px',
          '&:hover': {
            backgroundColor: 'rgba(102, 126, 234, 0.08)',
            borderColor: modernColors.primary.dark,
            transform: 'translateY(-1px)',
          },
        },
        text: {
          color: modernColors.primary.main,
          '&:hover': {
            backgroundColor: 'rgba(102, 126, 234, 0.08)',
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontSize: '0.75rem',
          height: '28px',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 700,
            backgroundColor: modernColors.grey[50],
            borderBottom: `2px solid ${modernColors.grey[200]}`,
            fontSize: '0.875rem',
            lineHeight: 1.4,
            letterSpacing: 0,
            color: modernColors.grey[700],
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${modernColors.grey[200]}`,
          fontSize: '0.875rem',
          lineHeight: 1.5,
          letterSpacing: 0,
          padding: '16px',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': {
              borderColor: modernColors.grey[300],
              borderWidth: '2px',
            },
            '&:hover fieldset': {
              borderColor: modernColors.grey[400],
            },
            '&.Mui-focused fieldset': {
              borderColor: modernColors.primary.main,
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          color: '#ffffff',
          boxShadow: 'none',
          borderBottom: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          '& .MuiTab-root': {
            minHeight: 64,
            fontSize: '1rem',
            fontWeight: 600,
            textTransform: 'none',
            '&.Mui-selected': {
              color: modernColors.primary.main,
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: modernColors.primary.main,
            height: 3,
            borderRadius: '3px 3px 0 0',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 500,
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/otp-login" element={<OTPLogin />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <SimpleDashboard />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/old-dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/diagnostic" element={<DiagnosticPage />} />

          {/* Role-specific dashboards */}
          <Route
            path="/admin/doctor"
            element={
              <AdminProtectedRoute>
                <DoctorDashboard />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/nurse"
            element={
              <AdminProtectedRoute>
                <NurseDashboard />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/registrar"
            element={
              <AdminProtectedRoute>
                <RegistrarDashboard />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/pharmacy"
            element={
              <AdminProtectedRoute>
                <PharmacyDashboard />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/lab"
            element={
              <AdminProtectedRoute>
                <LabDashboard />
              </AdminProtectedRoute>
            }
          />

          <Route
            path="/admin/patient-portal/:patientId"
            element={
              <AdminProtectedRoute>
                <AdminPatientPortalView />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <AdminPortal />
              </AdminProtectedRoute>
            }
          />
          <Route path="/" element={<LandingPage />} />
        </Routes>
        </Suspense>
      </Router>
    </ThemeProvider>
  );
}

export default App;
