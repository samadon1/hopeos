"use client"

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  UserPlus,
  CheckCircle,
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Home,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Check,
  ScanLine,
  X,
} from 'lucide-react';
import DocumentScanner from '../common/DocumentScanner';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api.service';
import { cache } from '../../utils/cache';

interface PatientFormData {
  // Personal Information
  givenName: string;
  middleName: string;
  familyName: string;
  gender: 'M' | 'F' | 'O' | '';
  birthdate: string;
  age: string;
  useAge: boolean; // If true, use age instead of birthdate
  birthdateEstimated: boolean;

  // Contact Information
  phoneNumber: string;
  email: string;

  // Person Attributes (Custom Fields)
  community: string;
  religion: string;
  occupation: string;
  maritalStatus: string;
  educationLevel: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;

  // Patient Identifier
  identifierType: string;
  identifier: string;
  
  // Ghana-specific identifiers
  ghanaCardNumber: string;
  nhisNumber: string;
}

const initialFormData: PatientFormData = {
  givenName: '',
  middleName: '',
  familyName: '',
  gender: '',
  birthdate: '',
  age: '',
  useAge: false,
  birthdateEstimated: false,
  phoneNumber: '',
  email: '',
  community: '',
  religion: '',
  occupation: '',
  maritalStatus: '',
  educationLevel: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  identifierType: '',
  identifier: '',
  ghanaCardNumber: '',
  nhisNumber: '',
};

interface PatientRegistrationProps {
  onRegistrationComplete?: (patientId: string) => void;
}

// Interface for extracted data from document scanner
interface ExtractedPatientData {
  givenName?: string;
  middleName?: string;
  familyName?: string;
  gender?: 'M' | 'F' | '';
  birthdate?: string;
  phoneNumber?: string;
  ghanaCardNumber?: string;
  nhisNumber?: string;
  community?: string;
  city?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export default function PatientRegistration({ onRegistrationComplete }: PatientRegistrationProps = {}) {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identifierTypes, setIdentifierTypes] = useState<Array<{ uuid: string; display: string; required: boolean }>>([]);
  const [loadingIdentifierTypes, setLoadingIdentifierTypes] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const steps = [
    { title: 'Personal Info', icon: User },
    { title: 'Contact & Address', icon: MapPin },
    { title: 'Identifiers', icon: CreditCard },
    { title: 'Review', icon: CheckCircle },
  ];

  // Auto-generate identifier when component mounts (Firestore doesn't need identifier types)
  useEffect(() => {
    const generateIdentifier = async () => {
      try {
        setLoadingIdentifierTypes(true);
        const generatedId = await apiService.generateIdentifier();
        setFormData(prev => ({ ...prev, identifier: generatedId }));
        console.log('Generated identifier:', generatedId);
      } catch (err) {
        console.error('Failed to generate identifier:', err);
      } finally {
        setLoadingIdentifierTypes(false);
      }
    };
    generateIdentifier();
  }, []);


  const handleChange = (field: keyof PatientFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });
    setError(null);
  };

  // Handle extracted data from document scanner
  // Note: Don't close the scanner here - let user see the success screen
  // and close it manually by clicking "Done"
  const handleScannerData = (data: ExtractedPatientData) => {
    setFormData(prev => ({
      ...prev,
      givenName: data.givenName || prev.givenName,
      middleName: data.middleName || prev.middleName,
      familyName: data.familyName || prev.familyName,
      gender: data.gender || prev.gender,
      birthdate: data.birthdate || prev.birthdate,
      useAge: false, // Reset to birthdate mode if we got a date
      phoneNumber: data.phoneNumber || prev.phoneNumber,
      ghanaCardNumber: data.ghanaCardNumber || prev.ghanaCardNumber,
      nhisNumber: data.nhisNumber || prev.nhisNumber,
      community: data.community || data.city || prev.community,
      emergencyContactName: data.emergencyContactName || prev.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone || prev.emergencyContactPhone,
    }));
    // Don't close here - let user see success screen and click "Done"
    setError(null);
  };

  const validateStep = (step: number): boolean => {
    if (step === 0) {
      if (!formData.givenName || !formData.familyName || !formData.gender) {
        setError('Please fill in all required personal information fields');
        return false;
      }
      if (!formData.useAge && !formData.birthdate) {
        setError('Please provide either date of birth or age');
        return false;
      }
      if (formData.useAge && (!formData.age || parseInt(formData.age) < 0 || parseInt(formData.age) > 150)) {
        setError('Please enter a valid age (0-150)');
        return false;
      }
    } else if (step === 1) {
      if (!formData.community) {
        setError('Community is required');
        return false;
      }
    } else if (step === 2) {
      if (!formData.identifier) {
        setError('Patient identifier is required');
        return false;
      }
    } else if (step === 3) {
      // Review step - no validation needed, just review
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prevStep) => prevStep + 1);
      setError(null);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!validateStep(activeStep)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Calculate birthdate from age if age is used
      let birthdate = formData.birthdate;
      let birthdateEstimated = formData.birthdateEstimated;
      
      if (formData.useAge && formData.age) {
        const age = parseInt(formData.age);
        const today = new Date();
        const estimatedBirthYear = today.getFullYear() - age;
        // Use January 1st of estimated year as birthdate
        birthdate = `${estimatedBirthYear}-01-01`;
        birthdateEstimated = true;
      }

      // Register patient via API
      const result = await apiService.registerPatient({
        firstName: formData.givenName,
        middleName: formData.middleName,
        lastName: formData.familyName,
        gender: formData.gender,
        birthdate: birthdate,
        birthdateEstimated: birthdateEstimated,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        community: formData.community,
        religion: formData.religion,
        occupation: formData.occupation,
        maritalStatus: formData.maritalStatus,
        educationLevel: formData.educationLevel,
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
        emergencyContactRelationship: formData.emergencyContactRelationship,
        identifier: formData.identifier,
        ghanaCardNumber: formData.ghanaCardNumber,
        nhisNumber: formData.nhisNumber,
      });
      
      const patientId = result.id || result.identifier;
      
      // Clear patient cache so new patient appears in search immediately
      cache.clear('patients_all');
      cache.clear('patients_' + (formData.community || 'all'));
      cache.clear('communities');

      // If callback provided (registrar role), use it; otherwise navigate to patient portal
      if (onRegistrationComplete) {
        // Reset form for next registration
        setFormData(initialFormData);
        setActiveStep(0);
        // Call callback with patient ID
        onRegistrationComplete(patientId);
      } else {
        // Navigate directly to patient portal/chart (for nurse/doctor/admin)
        navigate(`/admin/patient-portal/${patientId}`, {
          state: { patient: result }
        });
      }
    } catch (err: any) {
      console.error('Error registering patient:', err);
      setError(err.response?.data?.error?.message || 'Failed to register patient. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setActiveStep(0);
    setError(null);
  };

  return (
    <div className="space-y-8">
      {/* Progress Stepper */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${
                    index < activeStep
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
                      : index === activeStep
                      ? 'bg-gradient-to-br from-olive-500 to-olive-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {index < activeStep ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    <step.icon className="h-6 w-6" />
                  )}
                </div>
                <p
                  className={`mt-2 text-sm font-semibold ${
                    index <= activeStep ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step.title}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 rounded ${
                    index < activeStep ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900 mb-1">Validation Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
        {/* Step 0: Personal Information */}
        {activeStep === 0 && (
          <div className="space-y-6">
            <div className="mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                    <User className="mr-2 h-6 w-6 text-olive-600" />
                    Personal Information
                  </h2>
                  <p className="text-gray-600">Enter the patient's basic personal details</p>
                </div>
                <button
                  onClick={() => setShowScanner(true)}
                  className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-olive-500 to-olive-600 hover:from-olive-600 hover:to-olive-700 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md"
                >
                  <ScanLine className="mr-2 h-5 w-5" />
                  Scan Document
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.givenName}
                  onChange={handleChange('givenName')}
                  required
                  placeholder="Enter first name"
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Middle Name
                </label>
                <input
                  type="text"
                  value={formData.middleName}
                  onChange={handleChange('middleName')}
                  placeholder="Enter middle name (optional)"
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.familyName}
                  onChange={handleChange('familyName')}
                  required
                  placeholder="Enter last name"
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.gender}
                  onChange={handleChange('gender')}
                  required
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500 bg-white"
                >
                  <option value="">Select gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Date of Birth / Age <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="birthdateType"
                      checked={!formData.useAge}
                      onChange={() => setFormData({ ...formData, useAge: false })}
                      className="mr-2 text-olive-600 focus:ring-olive-500"
                    />
                    <span className="text-sm text-gray-700">Date of Birth</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="birthdateType"
                      checked={formData.useAge}
                      onChange={() => setFormData({ ...formData, useAge: true })}
                      className="mr-2 text-olive-600 focus:ring-olive-500"
                    />
                    <span className="text-sm text-gray-700">Age (if exact date unknown)</span>
                  </label>
                </div>
                {!formData.useAge ? (
                  <input
                    type="date"
                    value={formData.birthdate}
                    onChange={handleChange('birthdate')}
                    required={!formData.useAge}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                  />
                ) : (
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="0"
                      max="150"
                      value={formData.age}
                      onChange={handleChange('age')}
                      required={formData.useAge}
                      placeholder="Enter age in years"
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                    />
                    <span className="text-sm text-gray-600 whitespace-nowrap">years old</span>
                  </div>
                )}
                {formData.useAge && (
                  <p className="text-xs text-gray-500 mt-2">
                    Birthdate will be estimated as January 1st of the calculated year
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Contact & Address */}
        {activeStep === 1 && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                <MapPin className="mr-2 h-6 w-6 text-olive-600" />
                Contact & Address Information
              </h2>
              <p className="text-gray-600">Provide contact details and address</p>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Phone className="mr-2 h-5 w-5 text-emerald-600" />
                Contact Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={handleChange('phoneNumber')}
                      placeholder="e.g. +233 24 123 4567 (optional)"
                      className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={handleChange('email')}
                      placeholder="email@example.com (optional)"
                      className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4 pt-6 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Home className="mr-2 h-5 w-5 text-amber-600" />
                Additional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Community <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.community}
                    onChange={handleChange('community')}
                    required
                    placeholder="Enter community name"
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Religion
                  </label>
                  <select
                    value={formData.religion}
                    onChange={handleChange('religion')}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500 bg-white"
                  >
                    <option value="">Select religion (optional)</option>
                    <option value="Christianity">Christianity</option>
                    <option value="Islam">Islam</option>
                    <option value="Traditional">Traditional / African Traditional Religion</option>
                    <option value="No Religion">No Religion</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={formData.occupation}
                    onChange={handleChange('occupation')}
                    placeholder="Enter occupation (optional)"
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Marital Status
                  </label>
                  <select
                    value={formData.maritalStatus}
                    onChange={handleChange('maritalStatus')}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500 bg-white"
                  >
                    <option value="">Select marital status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Education Level
                  </label>
                  <select
                    value={formData.educationLevel}
                    onChange={handleChange('educationLevel')}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500 bg-white"
                  >
                    <option value="">Select education level</option>
                    <option value="None">None</option>
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                    <option value="Tertiary">Tertiary</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4 pt-6 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <AlertCircle className="mr-2 h-5 w-5 text-red-600" />
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContactName}
                    onChange={handleChange('emergencyContactName')}
                    placeholder="Enter contact name"
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={handleChange('emergencyContactPhone')}
                    placeholder="e.g. +233 24 123 4567"
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContactRelationship}
                    onChange={handleChange('emergencyContactRelationship')}
                    placeholder="e.g. Mother, Father, Spouse"
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Identifiers */}
        {activeStep === 2 && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                <CreditCard className="mr-2 h-6 w-6 text-olive-600" />
                Patient Identifiers
              </h2>
              <p className="text-gray-600">Assign identifiers for patient tracking</p>
            </div>

            {/* Identifier Section */}
            <div className="bg-olive-50 border border-olive-200 rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <CreditCard className="mr-2 h-5 w-5 text-olive-600" />
                Patient Identifiers
              </h3>

              {loadingIdentifierTypes ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-olive-600" />
                  <span className="ml-2 text-sm text-gray-600">Loading identifier types...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* System-generated identifier */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        System Identifier <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.identifier}
                        onChange={handleChange('identifier')}
                        required
                        placeholder="Auto-generated"
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500 bg-gray-50"
                        readOnly
                      />
                      <p className="text-xs text-gray-500 mt-1">Auto-generated unique identifier</p>
                    </div>
                  </div>

                  {/* Ghana Card Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ghana Card Number
                    </label>
                    <input
                      type="text"
                      value={formData.ghanaCardNumber}
                      onChange={handleChange('ghanaCardNumber')}
                      placeholder="Enter Ghana Card Number (optional)"
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500 bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">National ID card number for tracking</p>
                  </div>

                  {/* NHIS Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      NHIS Number
                    </label>
                    <input
                      type="text"
                      value={formData.nhisNumber}
                      onChange={handleChange('nhisNumber')}
                      placeholder="Enter NHIS Number (optional)"
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500 bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">National Health Insurance Scheme number</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {activeStep === 3 && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                <CheckCircle className="mr-2 h-6 w-6 text-emerald-600" />
                Review Information
              </h2>
              <p className="text-gray-600">Please review all information before submitting</p>
            </div>

            {/* Review Cards - Clean Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Details Card */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <div className="flex items-center mb-4 pb-3 border-b border-gray-100">
                  <User className="h-5 w-5 text-olive-600 mr-2" />
                  <h3 className="text-lg font-bold text-gray-900">Personal Details</h3>
                </div>
                <dl className="space-y-3">
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full Name</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.givenName} {formData.middleName} {formData.familyName}
                    </dd>
                  </div>
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Gender</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.gender === 'M' ? 'Male' : formData.gender === 'F' ? 'Female' : formData.gender === 'O' ? 'Other' : 'Not specified'}
                    </dd>
                  </div>
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      {formData.useAge ? 'Age (Estimated)' : 'Date of Birth'}
                    </dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.useAge ? `${formData.age} years old` : formData.birthdate || 'Not provided'}
                      {formData.useAge && <span className="text-xs text-gray-500 ml-2 font-normal">(estimated)</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">System Identifier</dt>
                    <dd className="text-base font-bold text-gray-900 font-mono">
                      {formData.identifier || 'Generating...'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Contact & Additional Info Card */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <div className="flex items-center mb-4 pb-3 border-b border-gray-100">
                  <MapPin className="h-5 w-5 text-olive-600 mr-2" />
                  <h3 className="text-lg font-bold text-gray-900">Contact & Additional Info</h3>
                </div>
                <dl className="space-y-3">
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</dt>
                    <dd className="text-base font-semibold text-gray-900">{formData.phoneNumber}</dd>
                  </div>
                  {formData.email && (
                    <div className="pb-3 border-b border-gray-100">
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</dt>
                      <dd className="text-base font-semibold text-gray-900">{formData.email}</dd>
                    </div>
                  )}
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Community</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.community || <span className="text-gray-400 italic font-normal">Not specified</span>}
                    </dd>
                  </div>
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Religion</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.religion || <span className="text-gray-400 italic font-normal">Not provided</span>}
                    </dd>
                  </div>
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Occupation</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.occupation || <span className="text-gray-400 italic font-normal">Not provided</span>}
                    </dd>
                  </div>
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Marital Status</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.maritalStatus || <span className="text-gray-400 italic font-normal">Not provided</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Education Level</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.educationLevel || <span className="text-gray-400 italic font-normal">Not provided</span>}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Identifiers Card */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <div className="flex items-center mb-4 pb-3 border-b border-gray-100">
                  <CreditCard className="h-5 w-5 text-olive-600 mr-2" />
                  <h3 className="text-lg font-bold text-gray-900">Identifiers</h3>
                </div>
                <dl className="space-y-3">
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">System ID</dt>
                    <dd className="text-base font-bold text-gray-900 font-mono">
                      {formData.identifier || 'Generating...'}
                    </dd>
                  </div>
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ghana Card</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.ghanaCardNumber || <span className="text-gray-400 italic font-normal">Not provided</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">NHIS Number</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.nhisNumber || <span className="text-gray-400 italic font-normal">Not provided</span>}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Emergency Contact Card */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <div className="flex items-center mb-4 pb-3 border-b border-gray-100">
                  <AlertCircle className="h-5 w-5 text-olive-600 mr-2" />
                  <h3 className="text-lg font-bold text-gray-900">Emergency Contact</h3>
                </div>
                <dl className="space-y-3">
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact Name</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.emergencyContactName || <span className="text-gray-400 italic font-normal">Not provided</span>}
                    </dd>
                  </div>
                  <div className="pb-3 border-b border-gray-100">
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact Phone</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.emergencyContactPhone || <span className="text-gray-400 italic font-normal">Not provided</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Relationship</dt>
                    <dd className="text-base font-semibold text-gray-900">
                      {formData.emergencyContactRelationship || <span className="text-gray-400 italic font-normal">Not provided</span>}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <button
          onClick={handleBack}
          disabled={activeStep === 0}
          className="inline-flex items-center px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="mr-2 h-5 w-5" />
          Back
        </button>

        {activeStep < steps.length - 1 ? (
          <button
            onClick={handleNext}
            className="inline-flex items-center px-8 py-3 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors"
          >
            {activeStep === steps.length - 2 ? 'Review' : 'Next'}
            <ChevronRight className="ml-2 h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-5 w-5" />
                Register Patient
              </>
            )}
          </button>
        )}
      </div>

      {/* Document Scanner Modal - rendered via portal to bypass stacking context */}
      {showScanner && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
        >
          <div className="w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <DocumentScanner
              onDataExtracted={handleScannerData}
              onClose={() => setShowScanner(false)}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
