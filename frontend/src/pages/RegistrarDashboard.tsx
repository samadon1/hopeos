import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, LogOut, CheckCircle } from 'lucide-react';
import PatientRegistration from '../components/admin/PatientRegistration';

export default function RegistrarDashboard() {
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastPatientId, setLastPatientId] = useState<string | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/admin/login');
  };

  const handleRegistrationComplete = (patientId: string) => {
    // Show success message and stay on registration page
    setLastPatientId(patientId);
    setShowSuccess(true);

    // Auto-hide success message after 5 seconds
    setTimeout(() => {
      setShowSuccess(false);
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-full flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Registrar Dashboard</h1>
                <p className="text-xs text-slate-500">Patient registration</p>
              </div>
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

      {/* Main Content */}
      <div className="p-6 lg:p-8">
        <div className="space-y-6">
          {/* Success Message */}
          {showSuccess && lastPatientId && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 animate-in slide-in-from-top">
              <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-900">Patient registered successfully!</p>
                <p className="text-xs text-emerald-700 mt-0.5">Patient ID: {lastPatientId}</p>
              </div>
              <button
                onClick={() => setShowSuccess(false)}
                className="text-emerald-600 hover:text-emerald-800 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Patient Registration */}
          <div className="bg-white border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 bg-emerald-50">
              <h2 className="text-lg font-semibold text-emerald-900">Register New Patient</h2>
              <p className="text-sm text-emerald-700 mt-1">Enter patient information to create a new record</p>
            </div>
            <div className="p-6">
              <PatientRegistration onRegistrationComplete={handleRegistrationComplete} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
