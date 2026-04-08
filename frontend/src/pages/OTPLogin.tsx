import React, { useState } from 'react';
import { User, Phone, Calendar, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api.service';

interface LoginData {
  fullName: string;
  dateOfBirth: string;
  phoneNumber: string;
}

const OTPLogin: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginData, setLoginData] = useState<LoginData>({
    fullName: '',
    dateOfBirth: '',
    phoneNumber: '',
  });

  // Normalize phone number for comparison (remove spaces, dashes, etc.)
  const normalizePhone = (phone: string): string => {
    return phone.replace(/[\s\-\(\)]/g, '');
  };

  // Normalize name for comparison (lowercase, trim)
  const normalizeName = (name: string): string => {
    return name.toLowerCase().trim();
  };

  const handleLogin = async () => {
    if (!loginData.fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!loginData.dateOfBirth) {
      setError('Please enter your date of birth');
      return;
    }
    if (!loginData.phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔍 Searching for patient:', {
        fullName: loginData.fullName.trim(),
        dateOfBirth: loginData.dateOfBirth,
        phoneNumber: loginData.phoneNumber.trim(),
      });

      // Search by first name (first word of full name) to get better results
      const firstName = loginData.fullName.trim().split(' ')[0];

      // Try searching by first name first, then by phone if no results
      let searchResults = await apiService.searchPatients(firstName);

      // If no results by name, try searching by phone number
      if (searchResults.length === 0) {
        const phoneDigits = loginData.phoneNumber.replace(/\D/g, '').slice(-9); // Last 9 digits
        searchResults = await apiService.searchPatients(phoneDigits);
      }

      console.log('📥 Search results:', searchResults);

      // Find exact match based on name, DOB, and phone
      const normalizedInputName = normalizeName(loginData.fullName);
      const normalizedInputPhone = normalizePhone(loginData.phoneNumber);
      const inputDOB = loginData.dateOfBirth; // YYYY-MM-DD format

      const matchedPatient = searchResults.find((patient: any) => {
        // Build full name from patient record
        const patientFullName = normalizeName(
          `${patient.firstName || ''} ${patient.middleName || ''} ${patient.lastName || ''}`.replace(/\s+/g, ' ').trim()
        );

        // Also check if first + last name matches (without middle name)
        const patientFirstLast = normalizeName(
          `${patient.firstName || ''} ${patient.lastName || ''}`.trim()
        );

        // Normalize patient phone
        const patientPhone = normalizePhone(patient.phoneNumber || '');

        // Get patient DOB - handle Firestore Timestamp
        let patientDOB = '';
        if (patient.birthdate) {
          if (patient.birthdate.toDate) {
            // Firestore Timestamp
            const date = patient.birthdate.toDate();
            patientDOB = date.toISOString().split('T')[0];
          } else if (typeof patient.birthdate === 'string') {
            patientDOB = patient.birthdate.split('T')[0];
          }
        }

        console.log('Comparing:', {
          inputName: normalizedInputName,
          patientFullName,
          patientFirstLast,
          inputPhone: normalizedInputPhone,
          patientPhone,
          inputDOB,
          patientDOB,
        });

        // Match: name matches (full or first+last) AND DOB matches AND phone matches
        const nameMatches = patientFullName.includes(normalizedInputName) ||
                          normalizedInputName.includes(patientFullName) ||
                          patientFirstLast.includes(normalizedInputName) ||
                          normalizedInputName.includes(patientFirstLast);

        const dobMatches = patientDOB === inputDOB;
        const phoneMatches = patientPhone === normalizedInputPhone ||
                           patientPhone.endsWith(normalizedInputPhone) ||
                           normalizedInputPhone.endsWith(patientPhone);

        return nameMatches && dobMatches && phoneMatches;
      });

      if (matchedPatient) {
        console.log('✅ Patient matched:', matchedPatient);

        // Store patient info in localStorage for the session
        const patient = matchedPatient as any;
        localStorage.setItem('custom_auth', 'true');
        localStorage.setItem('patient_portal_auth', 'true');
        localStorage.setItem('openmrs_patient_uuid', patient.id);
        localStorage.setItem('patient_name', `${patient.firstName} ${patient.lastName}`);
        localStorage.setItem('patient_phone', patient.phoneNumber || '');

        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        console.log('❌ No matching patient found');
        setError('No patient found with the provided information. Please check your details and try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred while verifying your identity. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <img
              src="https://pbs.twimg.com/profile_images/1775194896586117120/_bwDwJl2_400x400.jpg"
              alt="OKB Clinic"
              className="h-20 w-20 rounded-xl mx-auto mb-4 shadow-sm"
            />
            <h1 className="text-2xl font-bold text-slate-900 mb-1">OKB Patient Portal</h1>
            <p className="text-slate-600 text-sm">Access your medical records securely</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <div className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={loginData.fullName}
                  onChange={(e) => setLoginData(prev => ({ ...prev, fullName: e.target.value }))}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 text-base"
                  autoFocus
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date of Birth
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="date"
                  value={loginData.dateOfBirth}
                  onChange={(e) => setLoginData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 text-base"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={loginData.phoneNumber}
                  onChange={(e) => setLoginData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 text-base"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full px-6 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md mt-6"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <span>Access My Records</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {/* Help Text */}
          <p className="text-center text-xs text-slate-500 mt-6">
            Please enter the same information you provided when registering at the clinic.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OTPLogin;
