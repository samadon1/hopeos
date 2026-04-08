import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';


interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  
  // Check authentication from localStorage
  const customAuth = localStorage.getItem('custom_auth');
  const patientUuid = localStorage.getItem('openmrs_patient_uuid');

  // Redirect to login if not authenticated
  if (!customAuth || !patientUuid) {
    return <Navigate to="/otp-login" state={{ from: location }} replace />;
  }

  // Render protected content
  return <>{children}</>;
};

export default ProtectedRoute;
