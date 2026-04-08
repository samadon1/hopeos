import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Optional: specific roles allowed for this route
}

// Define which routes each role can access
const roleRoutePermissions: Record<string, string[]> = {
  admin: ['/admin', '/admin/doctor', '/admin/nurse', '/admin/registrar', '/admin/pharmacy', '/admin/lab', '/admin/patient-portal'],
  doctor: ['/admin/doctor', '/admin/patient-portal'],
  nurse: ['/admin/nurse', '/admin/patient-portal'],
  registrar: ['/admin/registrar', '/admin/patient-portal'],
  pharmacy: ['/admin/pharmacy', '/admin/patient-portal'],
  lab: ['/admin/lab', '/admin/patient-portal'],
};

// Get the redirect path for each role
const roleDefaultRoutes: Record<string, string> = {
  admin: '/admin',
  doctor: '/admin/doctor',
  nurse: '/admin/nurse',
  registrar: '/admin/registrar',
  pharmacy: '/admin/pharmacy',
  lab: '/admin/lab',
};

const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({ children, allowedRoles }) => {
  const location = useLocation();

  // Check admin authentication from localStorage
  const adminAuth = localStorage.getItem('admin_auth');
  const adminUser = localStorage.getItem('admin_user');

  // Redirect to admin login if not authenticated
  if (!adminAuth || !adminUser) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Verify the auth token is valid
  try {
    const authData = JSON.parse(adminAuth);
    if (authData.authenticated !== true) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
  } catch (error) {
    console.error('Invalid admin auth data:', error);
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Get user role
  let userRole = 'admin';
  try {
    const userData = JSON.parse(adminUser);
    userRole = userData.role || 'admin';
  } catch (error) {
    console.error('Invalid admin user data:', error);
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Check if allowedRoles prop is provided (explicit role check)
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      // Redirect to user's default route
      const defaultRoute = roleDefaultRoutes[userRole] || '/admin/login';
      return <Navigate to={defaultRoute} replace />;
    }
  } else {
    // Check role-based route permissions
    const allowedRoutes = roleRoutePermissions[userRole] || [];
    const currentPath = location.pathname;

    // Check if current path starts with any allowed route
    const hasAccess = allowedRoutes.some(route => {
      // Exact match for base routes
      if (currentPath === route) return true;
      // Allow sub-routes (e.g., /admin/patient-portal/123)
      if (currentPath.startsWith(route + '/')) return true;
      return false;
    });

    if (!hasAccess) {
      // Redirect to user's default route
      const defaultRoute = roleDefaultRoutes[userRole] || '/admin/login';
      console.warn(`Access denied: ${userRole} tried to access ${currentPath}, redirecting to ${defaultRoute}`);
      return <Navigate to={defaultRoute} replace />;
    }
  }

  // Render protected content
  return <>{children}</>;
};

export default AdminProtectedRoute;
