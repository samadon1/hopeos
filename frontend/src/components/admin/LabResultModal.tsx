"use client"

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FlaskConical, Loader2, CheckCircle, Image as ImageIcon, File } from 'lucide-react';

interface LabResultModalProps {
  order: any;
  onClose: () => void;
  onComplete: (orderId: string, order: any, result: string, notes?: string, attachments?: { imageUrls: string[]; fileUrls: Array<{ name: string; url: string }> }) => Promise<void>;
}

// Urinalysis parameter definitions
const URINALYSIS_PARAMETERS = [
  { key: 'appearance', label: 'Appearance', options: ['Clear', 'Hazy', 'Cloudy', 'Turbid'] },
  { key: 'color', label: 'Color', options: ['Straw', 'Amber', 'Bloody'] },
  { key: 'specificGravity', label: 'Specific Gravity', type: 'number', placeholder: 'e.g., 1.015', min: '1.000', max: '1.040', step: '0.001' },
  { key: 'ph', label: 'pH', type: 'number', placeholder: 'e.g., 6.0', min: '4.5', max: '9.0', step: '0.5' },
  { key: 'leukocytes', label: 'Leukocytes', options: ['Negative', 'Trace', '1+', '2+', '3+'] },
  { key: 'urobilinogen', label: 'Urobilinogen', options: ['Normal', '1+', '2+', '3+', '4+'] },
  { key: 'blood', label: 'Blood', options: ['Negative', 'Trace', '1+', '2+', '3+'] },
  { key: 'protein', label: 'Protein', options: ['Negative', 'Trace', '1+', '2+', '3+'] },
  { key: 'bilirubin', label: 'Bilirubin', options: ['Negative', '1+', '2+', '3+'] },
  { key: 'nitrites', label: 'Nitrites', options: ['Positive', 'Negative'] },
  { key: 'ketones', label: 'Ketones', options: ['Negative', 'Trace', 'Small', 'Moderate', 'Large'] },
  { key: 'glucose', label: 'Glucose', options: ['Negative', 'Trace', '1+', '2+', '3+', '4+'] },
];

// Typhoid parameter definitions
const TYPHOID_PARAMETERS = [
  { key: 'igg', label: 'IgG', options: ['Reactive', 'Non-reactive'] },
  { key: 'igm', label: 'IgM', options: ['Reactive', 'Non-reactive'] },
];

// Malaria RDT parameter definitions
const MALARIA_RDT_OPTIONS = ['Positive', 'Negative'];

// Hepatitis B parameter definitions
const HEPATITIS_B_OPTIONS = ['Reactive', 'Non-Reactive'];

// HIV 1&2 parameter definitions
const HIV_OPTIONS = ['Reactive', 'Non-Reactive'];

export default function LabResultModal({ order, onClose, onComplete }: LabResultModalProps) {
  const [result, setResult] = useState('');
  const [resultValue, setResultValue] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Structured results for Urinalysis
  const [urinalysisResults, setUrinalysisResults] = useState<Record<string, string>>({});

  // Structured results for Typhoid
  const [typhoidResults, setTyphoidResults] = useState<Record<string, string>>({});

  // State for structured test results
  const [malariaResult, setMalariaResult] = useState('');
  const [hepatitisBResult, setHepatitisBResult] = useState('');
  const [hivResult, setHivResult] = useState('');

  // Determine test type
  const testType = (order.testType || '').toLowerCase();
  const isUrinalysis = testType.includes('urine') || testType.includes('urinalysis');
  const isTyphoid = testType.includes('typhoid');
  const isMalariaRDT = testType.includes('malaria') || testType.includes('rdt');
  const isHepatitisB = testType.includes('hepatitis') && testType.includes('b');
  const isHIV = testType.includes('hiv');

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedImages(prev => [...prev, ...files]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (orderId: string): Promise<{ imageUrls: string[]; fileUrls: Array<{ name: string; url: string }> }> => {
    // Create local object URLs for selected files (file upload to server can be added later)
    const uploadedImageUrls = selectedImages.map(image => URL.createObjectURL(image));
    const uploadedFileUrls = selectedFiles.map(file => ({ name: file.name, url: URL.createObjectURL(file) }));
    return { imageUrls: uploadedImageUrls, fileUrls: uploadedFileUrls };
  };

  // Validate urinalysis form - at least one parameter must be filled
  const validateUrinalysis = () => {
    const filledFields = URINALYSIS_PARAMETERS.filter(param => urinalysisResults[param.key]);
    if (filledFields.length === 0) {
      setError('Please fill in at least one parameter');
      return false;
    }
    return true;
  };

  // Validate typhoid form
  const validateTyphoid = () => {
    const missingFields = TYPHOID_PARAMETERS.filter(param => !typhoidResults[param.key]);
    if (missingFields.length > 0) {
      setError(`Please fill in all parameters: ${missingFields.map(f => f.label).join(', ')}`);
      return false;
    }
    return true;
  };

  // Format urinalysis results for storage (only include filled parameters)
  const formatUrinalysisResult = () => {
    const lines = URINALYSIS_PARAMETERS
      .filter(param => urinalysisResults[param.key])
      .map(param => `${param.label}: ${urinalysisResults[param.key]}`);
    return lines.join('\n');
  };

  // Format typhoid results for storage
  const formatTyphoidResult = () => {
    return `IgG: ${typhoidResults.igg || 'N/A'}\nIgM: ${typhoidResults.igm || 'N/A'}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate based on test type
    if (isUrinalysis) {
      if (!validateUrinalysis()) return;
    } else if (isTyphoid) {
      if (!validateTyphoid()) return;
    } else if (isMalariaRDT) {
      if (!malariaResult) {
        setError('Please select a test result');
        return;
      }
    } else if (isHepatitisB) {
      if (!hepatitisBResult) {
        setError('Please select a test result');
        return;
      }
    } else if (isHIV) {
      if (!hivResult) {
        setError('Please select a test result');
        return;
      }
    } else if (!result.trim()) {
      setError('Please enter a test result');
      return;
    }

    setLoading(true);

    try {
      // Upload attachments if any
      let attachments: { imageUrls: string[]; fileUrls: Array<{ name: string; url: string }> } | undefined;
      if (selectedImages.length > 0 || selectedFiles.length > 0) {
        setUploading(true);
        attachments = await uploadAttachments(order.id);
        setUploading(false);
      }

      // Determine final result based on test type
      let finalResult: string;
      if (isUrinalysis) {
        finalResult = formatUrinalysisResult();
      } else if (isTyphoid) {
        finalResult = formatTyphoidResult();
      } else if (isMalariaRDT) {
        finalResult = malariaResult;
      } else if (isHepatitisB) {
        finalResult = hepatitisBResult;
      } else if (isHIV) {
        finalResult = hivResult;
      } else {
        // Generic result
        finalResult = isNumericTest && resultValue.trim()
          ? `${result} (${resultValue} g/dL)`
          : result;
      }

      await onComplete(order.id, order, finalResult.trim(), notes.trim() || undefined, attachments);
      onClose();
    } catch (err: any) {
      console.error('Error completing test:', err);
      setError(err.message || 'Failed to complete test. Please try again.');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  // Common result options based on test type (for generic tests)
  // Note: No intermediate/indeterminate options per user request
  const getResultOptions = () => {
    if (testType.includes('malaria') || testType.includes('rdt')) {
      return ['Positive', 'Negative'];
    }
    if (testType.includes('pregnancy')) {
      return ['Positive', 'Negative'];
    }
    if (testType.includes('hiv') || testType.includes('syphilis') || testType.includes('hepatitis')) {
      return ['Reactive', 'Non-Reactive'];
    }
    if (testType.includes('h.pylori')) {
      return ['Positive', 'Negative'];
    }
    if (testType.includes('hemoglobin') || testType.includes('hb')) {
      return ['Normal', 'Low', 'High'];
    }

    return ['Positive', 'Negative', 'Normal', 'Abnormal', 'Completed'];
  };

  const resultOptions = getResultOptions();
  const isNumericTest = testType.includes('hemoglobin') || testType.includes('hb');

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Render Urinalysis form
  const renderUrinalysisForm = () => (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 p-3 mb-4">
        <p className="text-sm text-amber-800 font-medium">Urinalysis - 12 Parameters</p>
        <p className="text-xs text-amber-600">Fill in the parameters as needed (at least one required)</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {URINALYSIS_PARAMETERS.map((param) => (
          <div key={param.key}>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {param.label}
            </label>
            {param.type === 'number' ? (
              <input
                type="number"
                value={urinalysisResults[param.key] || ''}
                onChange={(e) => setUrinalysisResults(prev => ({ ...prev, [param.key]: e.target.value }))}
                placeholder={param.placeholder}
                min={param.min}
                max={param.max}
                step={param.step}
                className="w-full px-3 py-2 text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            ) : (
              <select
                value={urinalysisResults[param.key] || ''}
                onChange={(e) => setUrinalysisResults(prev => ({ ...prev, [param.key]: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              >
                <option value="">Select...</option>
                {param.options?.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Render Typhoid form
  const renderTyphoidForm = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 p-3 mb-4">
        <p className="text-sm text-blue-800 font-medium">Typhoid Test - IgG / IgM</p>
        <p className="text-xs text-blue-600">Please select Reactive or Non-reactive for each</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {TYPHOID_PARAMETERS.map((param) => (
          <div key={param.key}>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {param.label} *
            </label>
            <div className="space-y-2">
              {param.options?.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTyphoidResults(prev => ({ ...prev, [param.key]: option }))}
                  className={`w-full px-4 py-3 border-2 text-sm font-medium transition-colors ${
                    typhoidResults[param.key] === option
                      ? option === 'Reactive'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-green-600 bg-green-50 text-green-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render Malaria RDT form
  const renderMalariaForm = () => (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 p-3 mb-4">
        <p className="text-sm text-orange-800 font-medium">Malaria RDT Test</p>
        <p className="text-xs text-orange-600">Please select Positive or Negative</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Test Result *
        </label>
        <div className="grid grid-cols-2 gap-4">
          {MALARIA_RDT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMalariaResult(option)}
              className={`px-6 py-4 border-2 text-base font-medium transition-colors ${
                malariaResult === option
                  ? option === 'Positive'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-green-600 bg-green-50 text-green-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Render Hepatitis B form
  const renderHepatitisBForm = () => (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 p-3 mb-4">
        <p className="text-sm text-purple-800 font-medium">Hepatitis B Test</p>
        <p className="text-xs text-purple-600">Please select Reactive or Non-Reactive</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Test Result *
        </label>
        <div className="grid grid-cols-2 gap-4">
          {HEPATITIS_B_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setHepatitisBResult(option)}
              className={`px-6 py-4 border-2 text-base font-medium transition-colors ${
                hepatitisBResult === option
                  ? option === 'Reactive'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-green-600 bg-green-50 text-green-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Render HIV 1&2 form
  const renderHIVForm = () => (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 p-3 mb-4">
        <p className="text-sm text-red-800 font-medium">HIV 1&2 Test</p>
        <p className="text-xs text-red-600">Please select Reactive or Non-Reactive</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Test Result *
        </label>
        <div className="grid grid-cols-2 gap-4">
          {HIV_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setHivResult(option)}
              className={`px-6 py-4 border-2 text-base font-medium transition-colors ${
                hivResult === option
                  ? option === 'Reactive'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-green-600 bg-green-50 text-green-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Render generic form (for other test types)
  const renderGenericForm = () => (
    <>
      {/* Result Selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Test Result *
        </label>
        <div className="grid grid-cols-2 gap-2">
          {resultOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setResult(option)}
              className={`px-4 py-3 border-2  text-sm font-medium transition-colors ${
                result === option
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={result}
          onChange={(e) => setResult(e.target.value)}
          placeholder="Or enter custom result..."
          className="mt-2 w-full px-4 py-3 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Numeric Value (for tests like Hemoglobin) */}
      {isNumericTest && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Value (g/dL)
          </label>
          <input
            type="number"
            step="0.1"
            value={resultValue}
            onChange={(e) => setResultValue(e.target.value)}
            placeholder="e.g., 12.5"
            className="w-full px-4 py-3 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      )}
    </>
  );

  const modalContent = (
    <div
      className="fixed z-[9999] flex items-center justify-center bg-black bg-opacity-50"
      style={{
        margin: 0,
        padding: 0,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        minHeight: '100vh',
        position: 'fixed',
        transform: 'translateZ(0)'
      }}
    >
      <div className={`bg-white max-w-lg w-full max-h-[90vh] flex flex-col m-4 ${isUrinalysis ? 'max-w-2xl' : ''}`}>
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-green-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Enter Lab Test Results</h2>
              <p className="text-sm text-slate-600">{order.testType || 'Lab Test'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100  transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Patient Info */}
          <div className="bg-blue-50 border border-blue-200  p-4">
            <p className="text-sm font-semibold text-blue-900">Patient</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-base text-blue-700">{order.patientName}</p>
              {order.patientGender && (
                <span className={`text-xs px-1.5 py-0.5 font-medium ${
                  order.patientGender.toLowerCase() === 'male'
                    ? 'bg-blue-200 text-blue-800'
                    : order.patientGender.toLowerCase() === 'female'
                    ? 'bg-pink-200 text-pink-800'
                    : 'bg-slate-200 text-slate-800'
                }`}>
                  {order.patientGender}
                </span>
              )}
              {order.patientAge !== undefined && (
                <span className="text-sm text-blue-600">{order.patientAge} years</span>
              )}
            </div>
            <p className="text-xs text-blue-600 mt-1">ID: {order.patientId}</p>
          </div>

          {/* Test Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Test Type
            </label>
            <div className="px-4 py-3 bg-slate-50 border border-slate-200  text-slate-700">
              {order.testType || 'Lab Test'}
            </div>
          </div>

          {/* Render form based on test type */}
          {isUrinalysis ? renderUrinalysisForm() : isTyphoid ? renderTyphoidForm() : isMalariaRDT ? renderMalariaForm() : isHepatitisB ? renderHepatitisBForm() : isHIV ? renderHIVForm() : renderGenericForm()}

          {/* Notes/Comments */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes or comments..."
              rows={3}
              className="w-full px-4 py-3 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Attachments Section */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Attachments (Optional)
            </label>
            <div className="space-y-4">
              {/* Images */}
              <div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full px-4 py-3 border-2 border-dashed border-slate-300  hover:border-green-400 hover:bg-green-50 transition-colors flex items-center justify-center space-x-2 text-slate-600"
                >
                  <ImageIcon className="h-5 w-5" />
                  <span>Add Images</span>
                </button>
                {selectedImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {selectedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover  border border-slate-300"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <p className="text-xs text-slate-600 mt-1 truncate">{image.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Files */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 border-2 border-dashed border-slate-300  hover:border-green-400 hover:bg-green-50 transition-colors flex items-center justify-center space-x-2 text-slate-600"
                >
                  <File className="h-5 w-5" />
                  <span>Add Files</span>
                </button>
                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50  border border-slate-200">
                        <div className="flex items-center space-x-3">
                          <File className="h-5 w-5 text-slate-500" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{file.name}</p>
                            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200  p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-slate-300  text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="flex-1 px-4 py-3 bg-green-600 text-white  font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Complete Test
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
