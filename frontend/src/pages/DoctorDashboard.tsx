import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, LogOut, Bell, FlaskConical, Pill, X, User, Clock } from 'lucide-react';
import { apiService } from '../services/api.service';
import PatientSearch from '../components/admin/PatientSearch';

interface Notification {
  id: string;
  orderId: string; // The actual Firestore document ID for the order
  type: 'lab' | 'medication';
  patientId: string;
  patientName: string;
  itemName: string;
  status: string;
  completedAt: Date;
  seen: boolean;
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const notificationRef = useRef<HTMLDivElement>(null);

  // Load seen notification IDs from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('doctor_seen_notifications');
    if (stored) {
      setSeenIds(new Set(JSON.parse(stored)));
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll for completed lab orders and dispensed medications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        // Fetch completed lab orders
        const labOrders = await apiService.getLabOrders('completed');
        const labNotifications: Notification[] = (labOrders || [])
          .map((order: any) => {
            const completedAt = order.completed_at || order.updated_at || new Date().toISOString();
            return {
              id: `lab_${order.id}`,
              orderId: order.id,
              type: 'lab' as const,
              patientId: order.patient_id,
              patientName: order.patient_name || 'Unknown Patient',
              itemName: order.test_name || order.test_type || 'Lab Test',
              status: 'Results Ready',
              completedAt: new Date(completedAt),
              seen: seenIds.has(`lab_${order.id}`),
            };
          })
          .filter((n: Notification) => n.completedAt >= twentyFourHoursAgo)
          .sort((a: Notification, b: Notification) => b.completedAt.getTime() - a.completedAt.getTime())
          .slice(0, 20);

        // Fetch dispensed pharmacy orders
        const pharmaOrders = await apiService.getPharmacyOrders('dispensed');
        const medNotifications: Notification[] = (pharmaOrders || [])
          .map((order: any) => {
            const completedAt = order.dispensed_at || order.updated_at || new Date().toISOString();
            return {
              id: `med_${order.id}`,
              orderId: order.id,
              type: 'medication' as const,
              patientId: order.patient_id,
              patientName: order.patient_name || 'Unknown Patient',
              itemName: order.medication_name || order.drug_name || 'Medication',
              status: 'Dispensed',
              completedAt: new Date(completedAt),
              seen: seenIds.has(`med_${order.id}`),
            };
          })
          .filter((n: Notification) => n.completedAt >= twentyFourHoursAgo)
          .sort((a: Notification, b: Notification) => b.completedAt.getTime() - a.completedAt.getTime())
          .slice(0, 20);

        setNotifications(
          [...labNotifications, ...medNotifications].sort(
            (a, b) => b.completedAt.getTime() - a.completedAt.getTime()
          )
        );
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [seenIds]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/admin/login');
  };

  const unreadCount = notifications.filter((n) => !seenIds.has(n.id)).length;

  const handleNotificationClick = (notification: Notification) => {
    // Mark as seen
    const newSeenIds = new Set(seenIds);
    newSeenIds.add(notification.id);
    setSeenIds(newSeenIds);
    localStorage.setItem('doctor_seen_notifications', JSON.stringify([...newSeenIds]));

    // Navigate to patient portal with tab and order info to auto-open the modal
    setShowNotifications(false);
    const tab = notification.type === 'lab' ? 'labs' : 'medications';
    navigate(`/admin/patient-portal/${notification.patientId}?tab=${tab}&type=${notification.type}&orderId=${notification.orderId}`);
  };

  const handleMarkAllRead = () => {
    const newSeenIds = new Set(seenIds);
    notifications.forEach((n) => newSeenIds.add(n.id));
    setSeenIds(newSeenIds);
    localStorage.setItem('doctor_seen_notifications', JSON.stringify([...newSeenIds]));
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Doctor Dashboard</h1>
                <p className="text-xs text-slate-500">Patient consultations and medical care</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white border border-slate-200 shadow-lg z-50">
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">No notifications</p>
                          <p className="text-xs text-slate-400 mt-1">Completed orders will appear here</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 transition-colors ${
                              !seenIds.has(notification.id) ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`h-8 w-8 flex items-center justify-center flex-shrink-0 ${
                                  notification.type === 'lab'
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : 'bg-purple-100 text-purple-600'
                                }`}
                              >
                                {notification.type === 'lab' ? (
                                  <FlaskConical className="h-4 w-4" />
                                ) : (
                                  <Pill className="h-4 w-4" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-semibold px-1.5 py-0.5 ${
                                      notification.status === 'Results Ready'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : notification.status === 'In Progress'
                                        ? 'bg-blue-100 text-blue-700'
                                        : notification.status === 'Pending'
                                        ? 'bg-orange-100 text-orange-700'
                                        : notification.type === 'medication'
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {notification.status}
                                  </span>
                                  {!seenIds.has(notification.id) && (
                                    <span className="h-2 w-2 bg-blue-600 rounded-full"></span>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-slate-900 mt-1 truncate">
                                  {notification.itemName}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <User className="h-3 w-3 text-slate-400" />
                                  <span className="text-xs text-slate-600 truncate">
                                    {notification.patientName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  <span className="text-xs text-slate-500">
                                    {formatTimeAgo(notification.completedAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
                        <p className="text-xs text-slate-500 text-center">
                          Showing last 24 hours
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-700 hover:bg-red-50 font-medium transition-colors text-sm"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 lg:p-8">
        <div className="space-y-6">
          {/* Patient Records */}
          <div className="bg-white border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 bg-blue-50">
              <h2 className="text-lg font-semibold text-blue-900">Patient Records</h2>
              <p className="text-sm text-blue-700 mt-1">Search and view patient information</p>
            </div>
            <div className="p-6">
              <PatientSearch />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
