"use client"

import { useState } from 'react';
import { FlaskConical, Pill, CheckCircle, Loader2, AlertCircle, Stethoscope } from 'lucide-react';
import apiService from '../../services/api.service';

export default function InitializeCatalogs() {
  const [initializing, setInitializing] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const initializeMedications = async () => {
    try {
      setInitializing(true);
      setError('');
      setSuccess('');
      
      const count = await apiService.initializeMedicationCatalog();
      setSuccess(`Successfully initialized ${count} medications!`);
    } catch (err: any) {
      console.error('Error initializing medications:', err);
      setError(err.message || 'Failed to initialize medications');
    } finally {
      setInitializing(false);
    }
  };

  const initializeLabTests = async () => {
    try {
      setInitializing(true);
      setError('');
      setSuccess('');
      
      const count = await apiService.initializeLabTestCatalog();
      setSuccess(`Successfully initialized ${count} lab tests!`);
    } catch (err: any) {
      console.error('Error initializing lab tests:', err);
      setError(err.message || 'Failed to initialize lab tests');
    } finally {
      setInitializing(false);
    }
  };

  const initializeDiagnoses = async () => {
    try {
      setInitializing(true);
      setError('');
      setSuccess('');
      
      const count = await apiService.initializeDiagnosisConcepts();
      setSuccess(`Successfully initialized ${count} diagnosis concepts!`);
    } catch (err: any) {
      console.error('Error initializing diagnoses:', err);
      setError(err.message || 'Failed to initialize diagnoses');
    } finally {
      setInitializing(false);
    }
  };

  const initializeAll = async () => {
    try {
      setInitializing(true);
      setError('');
      setSuccess('');
      
      const medCount = await apiService.initializeMedicationCatalog();
      const labCount = await apiService.initializeLabTestCatalog();
      
      setSuccess(`Successfully initialized ${medCount} medications and ${labCount} lab tests!`);
    } catch (err: any) {
      console.error('Error initializing catalogs:', err);
      setError(err.message || 'Failed to initialize catalogs');
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200  p-6 ">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Initialize Catalogs</h2>
        <p className="text-sm text-slate-600 mb-6">
          Initialize the medication, lab test, and diagnosis catalogs in Firestore. This only needs to be done once.
        </p>

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200  p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200  p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={initializeMedications}
            disabled={initializing}
            className="flex items-center gap-3 px-6 py-4 bg-blue-50 border border-blue-200  hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Pill className="h-6 w-6 text-blue-600" />
            <div className="text-left">
              <div className="font-semibold text-slate-900">Initialize Medications</div>
              <div className="text-xs text-slate-600">55 medications</div>
            </div>
            {initializing && <Loader2 className="h-4 w-4 animate-spin text-blue-600 ml-auto" />}
          </button>

          <button
            onClick={initializeLabTests}
            disabled={initializing}
            className="flex items-center gap-3 px-6 py-4 bg-green-50 border border-green-200  hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FlaskConical className="h-6 w-6 text-green-600" />
            <div className="text-left">
              <div className="font-semibold text-slate-900">Initialize Lab Tests</div>
              <div className="text-xs text-slate-600">9 lab tests</div>
            </div>
            {initializing && <Loader2 className="h-4 w-4 animate-spin text-green-600 ml-auto" />}
          </button>

          <button
            onClick={initializeDiagnoses}
            disabled={initializing}
            className="flex items-center gap-3 px-6 py-4 bg-orange-50 border border-orange-200  hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Stethoscope className="h-6 w-6 text-orange-600" />
            <div className="text-left">
              <div className="font-semibold text-slate-900">Initialize Diagnoses</div>
              <div className="text-xs text-slate-600">40 diagnoses</div>
            </div>
            {initializing && <Loader2 className="h-4 w-4 animate-spin text-orange-600 ml-auto" />}
          </button>

          <button
            onClick={initializeAll}
            disabled={initializing}
            className="flex items-center gap-3 px-6 py-4 bg-purple-50 border border-purple-200  hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="h-6 w-6 text-purple-600" />
            <div className="text-left">
              <div className="font-semibold text-slate-900">Initialize All</div>
              <div className="text-xs text-slate-600">All catalogs</div>
            </div>
            {initializing && <Loader2 className="h-4 w-4 animate-spin text-purple-600 ml-auto" />}
          </button>
        </div>
      </div>
    </div>
  );
}











