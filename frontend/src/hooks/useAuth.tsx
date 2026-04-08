import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { Patient, AuthState } from '../types';
import apiService from '../services/api.service';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    patient: null,
    loading: true,
    error: null,
  });

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      // Check if user info is stored
      const storedUser = localStorage.getItem('openmrs_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        
        // Verify session is still valid
        const currentUser = await apiService.getCurrentUser();
        
        if (currentUser && currentUser.uuid === user.uuid) {
          // Find associated patient if user has patient role or identifier
          let patient: Patient | null = null;
          try {
            // Try to find patient by username (common pattern)
            patient = await apiService.getPatientByIdentifier(user.username);
          } catch (error) {
            console.warn('No patient record found for user:', user.username);
          }

          setAuthState({
            isAuthenticated: true,
            user: currentUser,
            patient,
            loading: false,
            error: null,
          });
          return;
        }
      }
      
      // No valid session found
      setAuthState({
        isAuthenticated: false,
        user: null,
        patient: null,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Session check failed:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        patient: null,
        loading: false,
        error: 'Session expired',
      });
    }
  };

  const login = async (username: string, password: string): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const user = await apiService.login(username, password);
      
      // Try to find associated patient record
      let patient: Patient | null = null;
      try {
        patient = await apiService.getPatientByIdentifier(username);
      } catch (error) {
        // If no patient found by username, try searching by name
        try {
          const searchResults = await apiService.searchPatients(user.person.display);
          if (searchResults.length > 0) {
            patient = searchResults[0];
          }
        } catch (searchError) {
          console.warn('No patient record found for user:', username);
        }
      }

      setAuthState({
        isAuthenticated: true,
        user,
        patient,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Login failed:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        patient: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      });
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthState({
        isAuthenticated: false,
        user: null,
        patient: null,
        loading: false,
        error: null,
      });
    }
  };

  const refreshUser = async (): Promise<void> => {
    if (!authState.isAuthenticated) return;
    
    try {
      const user = await apiService.getCurrentUser();
      setAuthState(prev => ({ ...prev, user }));
    } catch (error) {
      console.error('Failed to refresh user:', error);
      await logout();
    }
  };

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth;
