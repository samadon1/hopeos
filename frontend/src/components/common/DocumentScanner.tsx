"use client"

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Upload,
  FileImage,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  RotateCcw,
  Edit2,
  Check,
} from 'lucide-react';
import apiService, { DocumentScanResponse, ExtractedField, PatientFromScanRequest, PatientFromScanResponse } from '../../services/api.service';

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
  medicalConditions?: string[];
  allergies?: string[];
  // Vitals
  bloodPressure?: string;
  pulse?: string;
  temperature?: string;
  weight?: string;
  height?: string;
  spo2?: string;
  // Medications
  currentMedications?: string[];
}

interface DocumentScannerProps {
  onDataExtracted?: (data: ExtractedPatientData) => void;
  onPatientCreated?: (response: PatientFromScanResponse) => void;
  onClose?: () => void;
}

// Type for editable fields
type EditableFields = { [key: string]: string };

export default function DocumentScanner({ onDataExtracted, onPatientCreated, onClose }: DocumentScannerProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'select' | 'capture' | 'processing' | 'results' | 'saving' | 'success'>('select');
  const [imageData, setImageData] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DocumentScanResponse | null>(null);
  const [saveResult, setSaveResult] = useState<PatientFromScanResponse | null>(null);

  // Editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<EditableFields>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      setImageData(base64);
      setStep('processing');
      await processImage(base64);
    } catch (err) {
      setError('Failed to read file');
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setStep('capture');
    } catch (err) {
      setError('Failed to access camera. Please use file upload instead.');
    }
  };

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];

    stopCamera();
    setImageData(base64);
    setStep('processing');
    processImage(base64);
  };

  // Process image with AI
  const processImage = async (base64: string) => {
    setScanning(true);
    setError(null);
    setEditedValues({});

    try {
      const response = await apiService.scanDocument(base64, 'auto');

      if (!response.success) {
        setError(response.error || 'Failed to scan document');
        setStep('select');
        return;
      }

      setResult(response);
      setStep('results');
    } catch (err: any) {
      setError(err.message || 'Failed to process document');
      setStep('select');
    } finally {
      setScanning(false);
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.5) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  // Format extracted value for display
  const formatValue = (field: ExtractedField | undefined): string => {
    if (!field || field.value === null) return '';
    if (Array.isArray(field.value)) return field.value.join(', ');
    return String(field.value);
  };

  // Get current value (edited or original)
  const getCurrentValue = (fieldKey: string, field: ExtractedField | undefined): string => {
    if (editedValues[fieldKey] !== undefined) {
      return editedValues[fieldKey];
    }
    return formatValue(field);
  };

  // Handle edit start
  const startEditing = (fieldKey: string, currentValue: string) => {
    setEditingField(fieldKey);
    if (editedValues[fieldKey] === undefined) {
      setEditedValues(prev => ({ ...prev, [fieldKey]: currentValue }));
    }
  };

  // Handle edit save
  const saveEdit = () => {
    setEditingField(null);
  };

  // Handle edit change
  const handleEditChange = (fieldKey: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [fieldKey]: value }));
  };

  // Accept extracted data and save to database
  const acceptData = async () => {
    if (!result?.extracted_data) return;

    const data = result.extracted_data;

    // Helper to get value (edited or original)
    const getValue = (key: string, field: ExtractedField | undefined): string | undefined => {
      if (editedValues[key] !== undefined && editedValues[key] !== '') {
        return editedValues[key];
      }
      return field?.value ? String(field.value) : undefined;
    };

    // Build request payload
    const firstName = getValue('first_name', data.first_name);
    const lastName = getValue('last_name', data.last_name);

    // Validate required fields
    if (!firstName || !lastName) {
      setError('First name and last name are required to create a patient record.');
      return;
    }

    const gender = getValue('gender', data.gender);
    let genderCode = 'U';
    if (gender) {
      const g = gender.toLowerCase();
      genderCode = g === 'male' ? 'M' : g === 'female' ? 'F' : 'U';
    }

    // Parse conditions and allergies
    const conditionsStr = editedValues['medical_conditions'] || (data.medical_conditions?.value ? formatValue(data.medical_conditions) : '');
    const allergiesStr = editedValues['allergies'] || (data.allergies?.value ? formatValue(data.allergies) : '');
    const medsStr = editedValues['current_medications'] || (data.current_medications?.value ? formatValue(data.current_medications) : '');

    // Parse emergency contact
    let emergencyContactName: string | undefined;
    let emergencyContactPhone: string | undefined;
    if (data.emergency_contact?.value) {
      const contact = String(data.emergency_contact.value);
      const parts = contact.split(/[-:]/).map(s => s.trim());
      if (parts.length >= 1) emergencyContactName = parts[0];
      if (parts.length >= 2) emergencyContactPhone = parts[1];
    }

    const requestData: PatientFromScanRequest = {
      first_name: firstName,
      middle_name: getValue('middle_name', data.middle_name),
      last_name: lastName,
      gender: genderCode,
      birthdate: getValue('birthdate', data.birthdate),
      phone_number: getValue('phone_number', data.phone_number),
      ghana_card_number: getValue('ghana_card_number', data.ghana_card_number),
      nhis_number: getValue('nhis_number', data.nhis_number),
      community: getValue('community', data.community),
      city: getValue('city', data.city),
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      medical_conditions: conditionsStr ? conditionsStr.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      allergies: allergiesStr ? allergiesStr.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      blood_pressure: getValue('blood_pressure', data.blood_pressure),
      pulse: getValue('pulse', data.pulse),
      temperature: getValue('temperature', data.temperature),
      weight: getValue('weight', data.weight),
      height: getValue('height', data.height),
      spo2: getValue('spo2', data.spo2),
      current_medications: medsStr ? medsStr.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    };

    // Save to database
    setStep('saving');
    setError(null);

    try {
      const response = await apiService.createPatientFromScan(requestData);
      setSaveResult(response);
      setStep('success');

      // Notify parent if callback provided
      if (onPatientCreated) {
        onPatientCreated(response);
      }

      // Also call legacy callback if provided (for backwards compatibility)
      if (onDataExtracted) {
        const extracted: ExtractedPatientData = {
          givenName: firstName,
          middleName: getValue('middle_name', data.middle_name),
          familyName: lastName,
          gender: genderCode as 'M' | 'F' | '',
          birthdate: getValue('birthdate', data.birthdate),
          phoneNumber: getValue('phone_number', data.phone_number),
          ghanaCardNumber: getValue('ghana_card_number', data.ghana_card_number),
          nhisNumber: getValue('nhis_number', data.nhis_number),
          community: getValue('community', data.community),
          city: getValue('city', data.city),
          emergencyContactName,
          emergencyContactPhone,
          medicalConditions: requestData.medical_conditions,
          allergies: requestData.allergies,
          bloodPressure: getValue('blood_pressure', data.blood_pressure),
          pulse: getValue('pulse', data.pulse),
          temperature: getValue('temperature', data.temperature),
          weight: getValue('weight', data.weight),
          height: getValue('height', data.height),
          spo2: getValue('spo2', data.spo2),
          currentMedications: requestData.current_medications,
        };
        onDataExtracted(extracted);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create patient record');
      setStep('results');
    }
  };

  // Reset scanner
  const reset = () => {
    stopCamera();
    setStep('select');
    setImageData(null);
    setResult(null);
    setSaveResult(null);
    setError(null);
    setEditedValues({});
    setEditingField(null);
  };

  // Required fields that must always be shown (even if empty)
  const requiredFields = ['first_name', 'last_name'];

  // Field definitions for rendering
  const fieldGroups = [
    {
      title: 'Demographics',
      fields: [
        { key: 'first_name', label: 'First Name *' },
        { key: 'middle_name', label: 'Middle Name' },
        { key: 'last_name', label: 'Last Name *' },
        { key: 'gender', label: 'Gender' },
        { key: 'birthdate', label: 'Date of Birth' },
        { key: 'ghana_card_number', label: 'Ghana Card Number' },
        { key: 'nhis_number', label: 'NHIS Number' },
        { key: 'phone_number', label: 'Phone Number' },
        { key: 'community', label: 'Community' },
        { key: 'city', label: 'City' },
      ]
    },
    {
      title: 'Medical Conditions',
      fields: [
        { key: 'medical_conditions', label: 'Conditions' },
        { key: 'allergies', label: 'Allergies' },
      ]
    },
    {
      title: 'Vitals',
      fields: [
        { key: 'blood_pressure', label: 'Blood Pressure' },
        { key: 'pulse', label: 'Pulse' },
        { key: 'temperature', label: 'Temperature' },
        { key: 'weight', label: 'Weight' },
        { key: 'height', label: 'Height' },
        { key: 'spo2', label: 'SpO2' },
      ]
    },
    {
      title: 'Medications',
      fields: [
        { key: 'current_medications', label: 'Current Medications' },
      ]
    }
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-olive-600 to-olive-700 px-6 py-4 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileImage className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Document Scanner</h3>
              <p className="text-sm text-olive-100">Auto-extracts patient information</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={() => { stopCamera(); onClose(); }}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Step: Select capture method */}
        {step === 'select' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Take a photo or upload an image of a Ghana Card, paper record, or referral letter.
              The AI will automatically detect and extract patient information.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={startCamera}
                className="flex flex-col items-center gap-3 p-6 bg-olive-50 hover:bg-olive-100 rounded-xl border-2 border-dashed border-olive-300 transition-colors"
              >
                <Camera className="w-10 h-10 text-olive-600" />
                <span className="font-medium text-olive-700">Take Photo</span>
                <span className="text-sm text-olive-600">Use camera to capture</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 bg-blue-50 hover:bg-blue-100 rounded-xl border-2 border-dashed border-blue-300 transition-colors"
              >
                <Upload className="w-10 h-10 text-blue-600" />
                <span className="font-medium text-blue-700">Upload Image</span>
                <span className="text-sm text-blue-600">Select from device</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Step: Camera capture */}
        {step === 'capture' && (
          <div className="space-y-4">
            <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-4 border-2 border-white/50 border-dashed rounded-lg pointer-events-none" />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { stopCamera(); setStep('select'); }}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="flex-1 px-4 py-3 bg-olive-600 hover:bg-olive-700 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Capture
              </button>
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 text-olive-600 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">Scanning Document...</p>
            <p className="text-gray-500 mt-2">Extracting patient information with AI</p>
          </div>
        )}

        {/* Step: Results */}
        {step === 'results' && result?.extracted_data && (
          <div className="space-y-4">
            {/* Document type detected */}
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">
                    {result.document_type === 'ghana_card' ? 'Ghana Card' :
                     result.document_type === 'paper_record' ? 'Paper Record' :
                     result.document_type === 'referral_letter' ? 'Referral Letter' : 'Document'} Detected
                  </p>
                </div>
              </div>
            </div>

            {/* Extracted fields by group */}
            {fieldGroups.map((group) => {
              const extractedData = result.extracted_data!;
              // Check if any fields in this group have data OR are required
              const hasDataOrRequired = group.fields.some(f => {
                const field = extractedData[f.key as keyof typeof extractedData];
                const hasValue = field && (field.value !== null && field.value !== undefined);
                const isRequired = requiredFields.includes(f.key);
                return hasValue || isRequired;
              });

              if (!hasDataOrRequired) return null;

              return (
                <div key={group.title} className="space-y-2">
                  <h4 className="font-medium text-gray-700 text-sm uppercase tracking-wide">
                    {group.title}
                  </h4>
                  <div className="grid gap-2">
                    {group.fields.map(({ key, label }) => {
                      const field = extractedData[key as keyof typeof extractedData] as ExtractedField | undefined;
                      const isRequired = requiredFields.includes(key);
                      const hasValue = field && field.value !== null && field.value !== undefined;

                      // Skip non-required fields that have no value
                      if (!hasValue && !isRequired) return null;

                      const currentValue = hasValue ? getCurrentValue(key, field) : (editedValues[key] || '');
                      const isEditing = editingField === key;

                      const isEmpty = !currentValue;
                      const needsAttention = isRequired && isEmpty;

                      return (
                        <div key={key} className={`flex items-center justify-between p-3 rounded-lg group ${needsAttention ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className={`text-xs ${needsAttention ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{label}</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editedValues[key] ?? currentValue}
                                onChange={(e) => handleEditChange(key, e.target.value)}
                                className="w-full font-medium text-gray-900 bg-white border border-olive-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-olive-500"
                                autoFocus
                                placeholder={isRequired ? 'Required' : ''}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') {
                                    setEditedValues(prev => {
                                      const next = { ...prev };
                                      delete next[key];
                                      return next;
                                    });
                                    setEditingField(null);
                                  }
                                }}
                              />
                            ) : (
                              <p
                                className={`font-medium break-words whitespace-normal cursor-pointer hover:text-olive-600 ${isEmpty ? 'text-red-400 italic' : 'text-gray-900'}`}
                                onClick={() => startEditing(key, currentValue)}
                              >
                                {isEmpty ? 'Click to add' : currentValue}
                                {editedValues[key] !== undefined && editedValues[key] !== formatValue(field) && (
                                  <span className="ml-2 text-xs text-olive-600">(edited)</span>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            {isEditing ? (
                              <button
                                onClick={saveEdit}
                                className="p-1.5 text-olive-600 hover:bg-olive-100 rounded transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => startEditing(key, currentValue)}
                                className={`p-1.5 hover:text-olive-600 hover:bg-olive-50 rounded transition-all ${needsAttention ? 'text-red-500 opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {result.notes && (
              <p className="text-sm text-gray-500 italic">{result.notes}</p>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2 sticky bottom-0 bg-white">
              <button
                onClick={reset}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Scan Again
              </button>
              <button
                onClick={acceptData}
                className="flex-1 px-4 py-3 bg-olive-600 hover:bg-olive-700 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Use This Data
              </button>
            </div>
          </div>
        )}

        {/* Step: Saving to database */}
        {step === 'saving' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 text-olive-600 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">Creating Patient Record...</p>
            <p className="text-gray-500 mt-2">Saving demographics, conditions, vitals, and medications</p>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && saveResult && (
          <div className="py-8 text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <div>
              <p className="text-xl font-semibold text-gray-900">Patient Created Successfully!</p>
              <p className="text-gray-500 mt-1">All extracted data has been saved to the database</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-left max-w-sm mx-auto">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Patient ID:</span>
                  <span className="font-mono font-medium text-gray-900">{saveResult.identifier}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 space-y-1">
                  <p className="text-sm text-gray-600">Records created:</p>
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    {saveResult.created.diagnoses > 0 && (
                      <span className="text-olive-600">• {saveResult.created.diagnoses} diagnoses</span>
                    )}
                    {saveResult.created.allergies > 0 && (
                      <span className="text-olive-600">• {saveResult.created.allergies} allergies</span>
                    )}
                    {saveResult.created.observations > 0 && (
                      <span className="text-olive-600">• {saveResult.created.observations} vitals</span>
                    )}
                    {saveResult.created.medications > 0 && (
                      <span className="text-olive-600">• {saveResult.created.medications} medications</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={reset}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Scan Another
              </button>
              <button
                onClick={() => {
                  // Navigate to patient chart
                  if (saveResult?.patient_id) {
                    navigate(`/admin/patient-portal/${saveResult.patient_id}`);
                  }
                  // Close modal
                  if (onClose) onClose();
                }}
                className="flex-1 px-4 py-3 bg-olive-600 hover:bg-olive-700 rounded-xl text-white font-medium transition-colors"
              >
                View Patient
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
