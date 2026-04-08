"use client"

import { useState, useRef } from 'react';
import { X, FileText, Upload, Image as ImageIcon, File, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import apiService from '../../services/api.service';

interface ClinicalNoteFormProps {
  patientUuid: string;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClinicalNoteForm({ patientUuid, patientName, onClose, onSuccess }: ClinicalNoteFormProps) {
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [fileUrls, setFileUrls] = useState<Array<{ name: string; url: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // File upload functionality - disabled during Firebase to FastAPI migration
  // TODO: Implement file uploads via the new backend API
  const uploadFiles = async (_patientDocId: string): Promise<{ imageUrls: string[]; fileUrls: Array<{ name: string; url: string }> }> => {
    console.warn('File uploads are temporarily disabled during backend migration');
    // Return empty arrays - files will be stored locally but not uploaded
    return {
      imageUrls: selectedImages.map(img => URL.createObjectURL(img)),
      fileUrls: selectedFiles.map(file => ({ name: file.name, url: URL.createObjectURL(file) }))
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!noteContent.trim()) {
      setError('Please enter note content');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get patient's document ID
      let patientDocId = patientUuid;
      try {
        const patient = await apiService.getPatient(patientUuid);
        patientDocId = patient.id;
      } catch (error) {
        // If getPatient fails, try searching by identifier
        try {
          const patients = await apiService.searchPatients(patientUuid);
          if (patients && patients.length > 0) {
            patientDocId = patients[0].id;
          }
        } catch (searchError) {
          console.error('Error searching for patient:', searchError);
        }
      }

      // Upload files if any
      let uploadedImageUrls: string[] = [];
      let uploadedFileUrls: Array<{ name: string; url: string }> = [];
      if (selectedImages.length > 0 || selectedFiles.length > 0) {
        const uploadResult = await uploadFiles(patientDocId);
        uploadedImageUrls = uploadResult.imageUrls;
        uploadedFileUrls = uploadResult.fileUrls;
      }

      // Create visit
      const now = new Date();
      const visit = await apiService.createVisit({
        patientId: patientDocId,
        patientName: patientName,
        visitType: 'Outpatient',
        location: 'OKB Clinic',
        startDatetime: now.toISOString(),
      });

      // Create encounter
      // Get current logged-in user's display name
      const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
      const providerName = adminUser.displayName || adminUser.username || 'Unknown User';

      const encounter = await apiService.createEncounter({
        patientId: patientDocId,
        visitId: visit.id,
        patientName: patientName,
        encounterType: 'Clinical Note',
        location: 'OKB Clinic',
        provider: adminUser.username || 'admin',
        providerName: providerName,
        encounterDatetime: now.toISOString(),
      });

      // Create observation (clinical note)
      const noteValue = JSON.stringify({
        title: noteTitle || 'Clinical Note',
        content: noteContent,
        images: uploadedImageUrls,
        files: uploadedFileUrls,
      });

      await apiService.createObservation({
        patientId: patientDocId,
        encounterId: encounter.id,
        visitId: visit.id,
        conceptType: 'Clinical Note',
        conceptCode: 'clinical_note',
        conceptDisplay: noteTitle || 'Clinical Note',
        valueType: 'text',
        value: noteContent,
        valueText: noteContent,
        obsDatetime: now.toISOString(),
        extraData: {
          title: noteTitle || 'Clinical Note',
          images: uploadedImageUrls,
          files: uploadedFileUrls,
        },
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error: any) {
      console.error('Error creating clinical note:', error);
      setError(error.message || 'Failed to create clinical note. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Add Clinical Note</h2>
              <p className="text-sm text-slate-600">{patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">Clinical note recorded successfully!</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Note Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Note Title (Optional)
            </label>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Consultation Notes, Follow-up, etc."
            />
          </div>

          {/* Note Content */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Note Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter clinical notes, observations, or documentation..."
              required
            />
          </div>

          {/* Images Section */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Images (Optional)
            </label>
            <div className="space-y-3">
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
                className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2 text-slate-600"
              >
                <ImageIcon className="h-5 w-5" />
                <span>Add Images</span>
              </button>
              {selectedImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {selectedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-slate-300"
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
          </div>

          {/* Files Section */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Files (Optional)
            </label>
            <div className="space-y-3">
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
                className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2 text-slate-600"
              >
                <File className="h-5 w-5" />
                <span>Add Files</span>
              </button>
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
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

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  <span>Save Note</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

