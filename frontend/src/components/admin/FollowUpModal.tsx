"use client"

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarClock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import apiService from '../../services/api.service';

interface FollowUpModalProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FollowUpModal({ patientId, patientName, onClose, onSuccess }: FollowUpModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    followUpReason: '',
    followUpNotes: '',
    followUpDate: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.followUpReason.trim()) {
      setError('Please enter the reason for follow-up');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Update patient with follow-up information
      await apiService.updatePatient(patientId, {
        needsFollowUp: true,
        followUpReason: formData.followUpReason.trim(),
        followUpNotes: formData.followUpNotes.trim() || null,
        followUpDate: new Date().toISOString(),
        followUpDateString: formData.followUpDate,
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error setting follow-up:', err);
      setError(err.message || 'Failed to set follow-up. Please try again.');
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
      <div className="bg-white max-w-lg w-full max-h-[90vh] flex flex-col m-4">
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-amber-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Schedule Follow-Up</h2>
              <p className="text-sm text-slate-600">{patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Patient Info */}
          <div className="bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm font-semibold text-amber-900">Patient</p>
            <p className="text-base text-amber-700">{patientName}</p>
            <p className="text-xs text-amber-600 mt-1">ID: {patientId}</p>
          </div>

          {/* Follow-Up Reason */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Reason for Follow-Up <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.followUpReason}
              onChange={(e) => setFormData({ ...formData, followUpReason: e.target.value })}
              placeholder="Enter the reason for scheduling a follow-up..."
              required
              disabled={loading}
              rows={4}
              className="w-full px-4 py-3 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Follow-Up Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={formData.followUpNotes}
              onChange={(e) => setFormData({ ...formData, followUpNotes: e.target.value })}
              placeholder="Add any additional notes or instructions..."
              disabled={loading}
              rows={3}
              className="w-full px-4 py-3 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Follow-Up Date */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Follow-Up Date
            </label>
            <input
              type="date"
              value={formData.followUpDate}
              onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              disabled={loading}
              className="w-full px-4 py-3 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 p-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">Follow-up scheduled successfully!</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || success}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 px-4 py-3 bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Scheduled!
                </>
              ) : (
                <>
                  <CalendarClock className="h-4 w-4" />
                  Schedule Follow-Up
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
