import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Avatar,
} from '@mui/material';
import { LockOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, loading, error } = useAuth();
  
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });
  const [validationError, setValidationError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!credentials.username.trim() || !credentials.password.trim()) {
      setValidationError('Please enter both username and password');
      return;
    }

    try {
      await login(credentials.username.trim(), credentials.password);
      navigate('/'); // Redirect to dashboard on successful login
    } catch (error) {
      console.error('Login failed:', error);
      // Error is handled by the auth context
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* OKB Logo */}
        <Avatar
          src="https://pbs.twimg.com/profile_images/1775194896586117120/_bwDwJl2_400x400.jpg"
          alt="OKB Clinic"
          sx={{ m: 1, width: 64, height: 64 }}
        />
        
        <Typography component="h1" variant="h4" gutterBottom>
          OKB Patient Portal
        </Typography>
        
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          Access your medical records, lab results, and appointments securely
        </Typography>

        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Avatar sx={{ m: 1, bgcolor: 'primary.main' }}>
              <LockOutlined />
            </Avatar>
            
            <Typography component="h2" variant="h5">
              Sign In
            </Typography>

            {(error || validationError) && (
              <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
                {validationError || error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                autoFocus
                value={credentials.username}
                onChange={handleInputChange}
                disabled={loading}
              />
              
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={credentials.password}
                onChange={handleInputChange}
                disabled={loading}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ 
                  mt: 3, 
                  mb: 2,
                  backgroundColor: '#0365AC', // OKB brand color
                  '&:hover': {
                    backgroundColor: '#0254A0',
                  }
                }}
                disabled={loading}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Signing In...
                  </Box>
                ) : (
                  'Sign In'
                )}
              </Button>

              <Typography variant="body2" color="text.secondary" align="center">
                Having trouble accessing your account?{' '}
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    // Future: Add contact info or help
                    alert('Please contact the clinic at your next visit for assistance.');
                  }}
                >
                  Contact Clinic
                </Button>
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Security Notice */}
        <Box sx={{ mt: 3, p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" align="center">
            🔒 Your health information is protected by advanced security measures.
            Never share your login credentials with anyone.
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;
