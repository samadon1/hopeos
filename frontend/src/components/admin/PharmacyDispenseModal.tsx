"use client"

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Pill, Loader2, CheckCircle, User, Calendar, FileText } from 'lucide-react';

interface PharmacyDispenseModalProps {
  order: any;
  onClose: () => void;
  onDispense: (orderId: string, order: any) => Promise<void>;
}

export default function PharmacyDispenseModal({ order, onClose, onDispense }: PharmacyDispenseModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDispense = async () => {
    // Check if already dispensed
    if (order.status === 'dispensed' || order.status === 'completed') {
      setError('This medication has already been dispensed.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onDispense(order.id, order);
      onClose();
    } catch (err: any) {
      console.error('Error dispensing medication:', err);
      setError(err.message || 'Failed to dispense medication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const orderDate = order.orderedDate?.toDate 
    ? order.orderedDate.toDate() 
    : order.orderedDate 
    ? new Date(order.orderedDate) 
    : null;
  const formattedDate = orderDate 
    ? orderDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) 
    : 'N/A';

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
    >
      <div className="bg-white   max-w-lg w-full max-h-[90vh] flex flex-col m-4">
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Pill className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Dispense Medication</h2>
              <p className="text-sm text-slate-600">Review order details before dispensing</p>
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Patient Info */}
          <div className="bg-blue-50 border border-blue-200  p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-semibold text-blue-900">Patient Information</p>
            </div>
            <p className="text-base text-blue-700 font-medium">{order.patientName}</p>
            <p className="text-xs text-blue-600 mt-1">ID: {order.patientId}</p>
          </div>

          {/* Medication Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Medication
              </label>
              <div className="px-4 py-3 bg-slate-50 border border-slate-200  text-slate-700 font-medium">
                {order.drugName || order.medicationName || order.medication || 'Unknown Medication'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Dosage
                </label>
                <div className="px-4 py-3 bg-slate-50 border border-slate-200  text-slate-700">
                  {order.dosage || 'As prescribed'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Quantity
                </label>
                <div className="px-4 py-3 bg-slate-50 border border-slate-200  text-slate-700">
                  {order.quantity || 1}
                </div>
              </div>
            </div>

            {order.instructions && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Instructions
                </label>
                <div className="px-4 py-3 bg-slate-50 border border-slate-200  text-slate-700">
                  {order.instructions}
                </div>
              </div>
            )}

            {order.notes && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Notes
                </label>
                <div className="px-4 py-3 bg-slate-50 border border-slate-200  text-slate-700">
                  {order.notes}
                </div>
              </div>
            )}
          </div>

          {/* Order Info */}
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4" />
              <span>Ordered: {formattedDate}</span>
            </div>
            {order.prescribedByName && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileText className="h-4 w-4" />
                <span>Prescribed by: {order.prescribedByName}</span>
              </div>
            )}
            {order.priority && (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  order.priority === 'urgent' 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {order.priority === 'urgent' ? 'Urgent' : 'Routine'}
                </span>
              </div>
            )}
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
              type="button"
              onClick={handleDispense}
              disabled={loading || order.status === 'dispensed' || order.status === 'completed'}
              className="flex-1 px-4 py-3 bg-blue-600 text-white  font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Dispensing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Confirm Dispense
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}











