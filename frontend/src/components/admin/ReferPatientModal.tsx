"use client"

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import apiService from '../../services/api.service';

interface ReferPatientModalProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReferPatientModal({ patientId, patientName, onClose, onSuccess }: ReferPatientModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    referredTo: '',
    referralReason: '',
    referralNotes: '',
    referralDate: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.referredTo.trim()) {
      setError('Please enter where the patient is being referred to');
      return;
    }

    if (!formData.referralReason.trim()) {
      setError('Please enter the reason for referral');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Update patient with referral information
      await apiService.updatePatient(patientId, {
        referred: true,
        referredTo: formData.referredTo.trim(),
        referralReason: formData.referralReason.trim(),
        referralNotes: formData.referralNotes.trim() || null,
        referralDate: new Date().toISOString(),
        referralDateString: formData.referralDate,
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error referring patient:', err);
      setError(err.message || 'Failed to refer patient. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

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
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white   max-w-lg w-full max-h-[90vh] flex flex-col m-4">
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Send className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Refer Patient</h2>
              <p className="text-sm text-slate-600">{patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100  transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Patient Info */}
          <div className="bg-blue-50 border border-blue-200  p-4">
            <p className="text-sm font-semibold text-blue-900">Patient</p>
            <p className="text-base text-blue-700">{patientName}</p>
            <p className="text-xs text-blue-600 mt-1">ID: {patientId}</p>
          </div>

          {/* Referred To */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Referred To <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.referredTo}
              onChange={(e) => setFormData({ ...formData, referredTo: e.target.value })}
              placeholder="e.g., Specialist Hospital, Another Clinic, etc."
              required
              disabled={loading}
              className="w-full px-4 py-3 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Referral Reason */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Reason for Referral <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.referralReason}
              onChange={(e) => setFormData({ ...formData, referralReason: e.target.value })}
              placeholder="Enter the reason for referring this patient..."
              required
              disabled={loading}
              rows={4}
              className="w-full px-4 py-3 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Referral Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={formData.referralNotes}
              onChange={(e) => setFormData({ ...formData, referralNotes: e.target.value })}
              placeholder="Add any additional notes or instructions..."
              disabled={loading}
              rows={3}
              className="w-full px-4 py-3 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Referral Date */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Referral Date
            </label>
            <input
              type="date"
              value={formData.referralDate}
              onChange={(e) => setFormData({ ...formData, referralDate: e.target.value })}
              disabled={loading}
              className="w-full px-4 py-3 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200  p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200  p-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">Patient referred successfully!</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || success}
              className="flex-1 px-4 py-3 border border-slate-300  text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 px-4 py-3 bg-blue-600 text-white  font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Referring...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Referred!
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Refer Patient
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




