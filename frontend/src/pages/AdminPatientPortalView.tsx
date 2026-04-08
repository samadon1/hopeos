import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import SimpleDashboard from './SimpleDashboard';

export default function AdminPatientPortalView() {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get notification params from URL
  const initialTab = searchParams.get('tab') || undefined;
  const notificationType = searchParams.get('type') as 'lab' | 'medication' | undefined;
  const notificationOrderId = searchParams.get('orderId') || undefined;

  const getCurrentUserRole = () => {
    try {
      const adminUser = localStorage.getItem('admin_user');
      if (adminUser) {
        const user = JSON.parse(adminUser);
        return user.role || 'admin';
      }
    } catch (error) {
      console.error('Error getting user role:', error);
    }
    return 'admin';
  };

  const handleBack = () => {
    const userRole = getCurrentUserRole();
    const roleRoutes: Record<string, string> = {
      admin: '/admin',
      doctor: '/admin/doctor',
      nurse: '/admin/nurse',
      registrar: '/admin/registrar',
      pharmacy: '/admin/pharmacy',
      lab: '/admin/lab',
    };
    navigate(roleRoutes[userRole] || '/admin');
  };

  if (!patientId) {
    return null;
  }

  return (
    <SimpleDashboard
      patientUuid={patientId}
      isAdminView={true}
      onBack={handleBack}
      initialTab={initialTab}
      notificationType={notificationType}
      notificationOrderId={notificationOrderId}
    />
  );
}
