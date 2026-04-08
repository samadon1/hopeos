"use client"

import { useState } from 'react';
import { X, Activity, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import apiService from '../../services/api.service';

interface VitalsFormProps {
  patientUuid: string;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface VitalsData {
  weight: string;
  height: string;
  temperature: string;
  systolicBP: string;
  diastolicBP: string;
  pulse: string;
  respiratoryRate: string;
  oxygenSaturation: string;
  fbs: string; // Fasting Blood Sugar
  rbs: string; // Random Blood Sugar
}

// Concept UUIDs from your OpenMRS instance
const CONCEPTS = {
  WEIGHT: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  HEIGHT: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  TEMPERATURE: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  SYSTOLIC_BP: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DIASTOLIC_BP: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  PULSE: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  RESPIRATORY_RATE: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  OXYGEN_SAT: '5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  FBS: '418f8ebb-57af-48ec-a594-03a54ce00c0d',
  RBS: '761d6153-8ec1-4065-abbb-cef1cda30227',
};

const VITALS_ENCOUNTER_TYPE = '67a71486-1a54-468f-ac3e-7091a9a79584';
const VITALS_FORM_UUID = 'fc67a9e7-6ac6-4939-b31a-eaed02b9e0e4';
const LOCATION_UUID = '44c3efb0-2583-4c80-a79e-1f756a03c0a1'; // Outpatient Clinic
const VISIT_TYPE_UUID = '7b0f5697-27e3-40c4-8bae-f4049abfb4ed'; // Facility Visit

export default function VitalsForm({ patientUuid, patientName, onClose, onSuccess }: VitalsFormProps) {
  const [vitals, setVitals] = useState<VitalsData>({
    weight: '',
    height: '',
    temperature: '',
    systolicBP: '',
    diastolicBP: '',
    pulse: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    fbs: '',
    rbs: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Calculate BMI
  const calculateBMI = () => {
    const weight = parseFloat(vitals.weight);
    const height = parseFloat(vitals.height);
    if (weight && height && height > 0) {
      const heightInMeters = height / 100;
      const bmi = weight / (heightInMeters * heightInMeters);
      return bmi.toFixed(1);
    }
    return null;
  };

  // Removed validateVitals - clinical warnings removed per user request

  const handleChange = (field: keyof VitalsData, value: string) => {
    setVitals(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

      // Validate that at least one vital is entered
      const hasData = Object.values(vitals).some(v => v.trim() !== '');
      if (!hasData) {
        setError('Please enter at least one vital sign');
        return;
      }

    try {
      setLoading(true);
      setError(null);

      console.log('🏥 Recording vitals for patient:', patientUuid);

      // Get patient's document ID (patientUuid might be identifier or doc ID)
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
          // Fall through and use patientUuid as-is (might be a doc ID already)
        }
      }

      // Step 1: Create visit via API
      const now = new Date();
      const visit = await apiService.createVisit({
        patientId: patientDocId,
        patientName: patientName,
        visitType: 'Outpatient',
        location: 'OKB Clinic',
        startDatetime: now.toISOString(),
      });
      console.log('✅ Visit created:', visit.id);

      // Step 2: Create encounter in Firestore
      // Get current logged-in user's display name
      const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
      const providerName = adminUser.displayName || adminUser.username || 'Unknown User';

      // Calculate BMI if weight and height are provided
      const bmi = calculateBMI();

      // Build structured vitals data for the encounter
      const vitalsData = {
        weight: vitals.weight ? { value: parseFloat(vitals.weight), unit: 'kg' } : null,
        height: vitals.height ? { value: parseFloat(vitals.height), unit: 'cm' } : null,
        temperature: vitals.temperature ? { value: parseFloat(vitals.temperature), unit: '°C' } : null,
        bloodPressure: (vitals.systolicBP || vitals.diastolicBP) ? {
          systolic: vitals.systolicBP ? parseFloat(vitals.systolicBP) : null,
          diastolic: vitals.diastolicBP ? parseFloat(vitals.diastolicBP) : null,
          unit: 'mmHg',
          display: `${vitals.systolicBP || '-'}/${vitals.diastolicBP || '-'} mmHg`,
        } : null,
        pulse: vitals.pulse ? { value: parseFloat(vitals.pulse), unit: 'bpm' } : null,
        respiratoryRate: vitals.respiratoryRate ? { value: parseFloat(vitals.respiratoryRate), unit: 'breaths/min' } : null,
        oxygenSaturation: vitals.oxygenSaturation ? { value: parseFloat(vitals.oxygenSaturation), unit: '%' } : null,
        fbs: vitals.fbs ? { value: parseFloat(vitals.fbs), unit: 'mg/dL' } : null,
        rbs: vitals.rbs ? { value: parseFloat(vitals.rbs), unit: 'mg/dL' } : null,
        bmi: bmi ? { value: parseFloat(bmi), unit: 'kg/m²' } : null,
      };

      const encounter = await apiService.createEncounter({
        patientId: patientDocId,
        visitId: visit.id,
        patientName: patientName,
        encounterType: 'Vitals',
        location: 'OKB Clinic',
        provider: adminUser.username || 'admin',
        providerName: providerName,
        encounterDatetime: now.toISOString(),
        vitalsData: vitalsData,
      });
      console.log('✅ Vitals encounter created:', encounter.id);

      // Step 3: Create observations for each vital sign
      const observations = [];
      const obsDatetime = now.toISOString();

      if (vitals.weight) {
        observations.push(
          apiService.createObservation({
            patientId: patientDocId,
            encounterId: encounter.id,
            visitId: visit.id,
            conceptType: 'vital_signs',
            conceptCode: 'weight',
            conceptDisplay: 'Weight',
            valueType: 'numeric',
            value: parseFloat(vitals.weight),
            valueNumeric: parseFloat(vitals.weight),
            unit: 'kg',
            obsDatetime: obsDatetime,
          })
        );
      }
      if (vitals.height) {
        observations.push(
          apiService.createObservation({
            patientId: patientDocId,
            encounterId: encounter.id,
            visitId: visit.id,
            conceptType: 'vital_signs',
            conceptCode: 'height',
            conceptDisplay: 'Height',
            valueType: 'numeric',
            value: parseFloat(vitals.height),
            valueNumeric: parseFloat(vitals.height),
            unit: 'cm',
            obsDatetime: obsDatetime,
          })
        );
      }
      if (vitals.temperature) {
        observations.push(
          apiService.createObservation({
            patientId: patientDocId,
            encounterId: encounter.id,
            visitId: visit.id,
            conceptType: 'vital_signs',
            conceptCode: 'temperature',
            conceptDisplay: 'Temperature',
            valueType: 'numeric',
            value: parseFloat(vitals.temperature),
            valueNumeric: parseFloat(vitals.temperature),
            unit: '°C',
            obsDatetime: obsDatetime,
          })
        );
      }
      if (vitals.systolicBP) {
        observations.push(
          apiService.createObservation({
            patientId: patientDocId,
            encounterId: encounter.id,
            visitId: visit.id,
            conceptType: 'vital_signs',
            conceptCode: 'systolic_bp',
            conceptDisplay: 'Systolic Blood Pressure',
            valueType: 'numeric',
            value: parseFloat(vitals.systolicBP),
            valueNumeric: parseFloat(vitals.systolicBP),
            unit: 'mmHg',
            obsDatetime: obsDatetime,
          })
        );
      }
      if (vitals.diastolicBP) {
        observations.push(
          apiService.createObservation({
            patientId: patientDocId,
            encounterId: encounter.id,
            visitId: visit.id,
            conceptType: 'vital_signs',
            conceptCode: 'diastolic_bp',
            conceptDisplay: 'Diastolic Blood Pressure',
            valueType: 'numeric',
            value: parseFloat(vitals.diastolicBP),
            valueNumeric: parseFloat(vitals.diastolicBP),
            unit: 'mmHg',
            obsDatetime: obsDatetime,
          })
        );
      }
      if (vitals.pulse) {
        observations.push(
          apiService.createObservation({
            patientId: patientDocId,
            encounterId: encounter.id,
            visitId: visit.id,
            conceptType: 'vital_signs',
            conceptCode: 'pulse',
            conceptDisplay: 'Pulse',
            valueType: 'numeric',
            value: parseFloat(vitals.pulse),
            valueNumeric: parseFloat(vitals.pulse),
            unit: 'bpm',
            obsDatetime: obsDatetime,
          })
        );
      }
      if (vitals.respiratoryRate) {
        observations.push(
          apiService.createObservation({
            patientId: patientDocId,
            encounterId: encounter.id,
            visitId: visit.id,
            conceptType: 'vital_signs',
            conceptCode: 'respiratory_rate',
            conceptDisplay: 'Respiratory Rate',
            valueType: 'numeric',
            value: parseFloat(vitals.respiratoryRate),
            valueNumeric: parseFloat(vitals.respiratoryRate),
            unit: '/min',
            obsDatetime: obsDatetime,
          })
        );
      }
      if (vitals.oxygenSaturation) {
        observations.push(
          apiService.createObservation({
            patientId: patientDocId,
            encounterId: encounter.id,
            visitId: visit.id,
            conceptType: 'vital_signs',
            conceptCode: 'oxygen_saturation',
            conceptDisplay: 'Oxygen Saturation',
            valueType: 'numeric',
            value: parseFloat(vitals.oxygenSaturation),
            valueNumeric: parseFloat(vitals.oxygenSaturation),
            unit: '%',
            obsDatetime: obsDatetime,
          })
        );
      }
      if (vitals.fbs) {
        observations.push(
          apiService.createObservation({
            patientId: patientDocId,
            encounterId: encounter.id,
            visitId: visit.id,
            conceptType: 'vital_signs',
            conceptCode: 'fbs',
            conceptDisplay: 'Fasting Blood Sugar',
            valueType: 'numeric',
            value: parseFloat(vitals.fbs),
            valueNumeric: parseFloat(vitals.fbs),
            unit: 'mg/dL',
            obsDatetime: obsDatetime,
          })
        );
      }
      if (vitals.rbs) {
        observations.push(
          apiService.createObservation({
            patientId: patientDocId,
            encounterId: encounter.id,
            visitId: visit.id,
            conceptType: 'vital_signs',
            conceptCode: 'rbs',
            conceptDisplay: 'Random Blood Sugar',
            valueType: 'numeric',
            value: parseFloat(vitals.rbs),
            valueNumeric: parseFloat(vitals.rbs),
            unit: 'mg/dL',
            obsDatetime: obsDatetime,
          })
        );
      }

      await Promise.all(observations);
      console.log(`✅ Created ${observations.length} vital observations`);

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error('Error recording vitals:', err);
      setError(err.message || 'Failed to record vitals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const bmi = calculateBMI();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white  shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-100  flex items-center justify-center">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Record Vitals</h2>
              <p className="text-sm text-slate-600">{patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8  hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200  p-4 flex items-center space-x-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">Vitals recorded successfully!</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200  p-4 flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          )}


          {/* Body Measurements */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Body Measurements</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={vitals.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 70.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={vitals.height}
                  onChange={(e) => handleChange('height', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 170"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  BMI {bmi && <span className="text-blue-600 font-semibold">({bmi})</span>}
                </label>
                <input
                  type="text"
                  value={bmi || 'Auto-calculated'}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200  bg-slate-50 text-slate-600"
                />
              </div>
            </div>
          </div>

          {/* Vital Signs */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Vital Signs</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={vitals.temperature}
                  onChange={(e) => handleChange('temperature', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 37.2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pulse (bpm)
                </label>
                <input
                  type="number"
                  value={vitals.pulse}
                  onChange={(e) => handleChange('pulse', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 72"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Systolic BP (mmHg)
                </label>
                <input
                  type="number"
                  value={vitals.systolicBP}
                  onChange={(e) => handleChange('systolicBP', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 120"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Diastolic BP (mmHg)
                </label>
                <input
                  type="number"
                  value={vitals.diastolicBP}
                  onChange={(e) => handleChange('diastolicBP', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 80"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Respiratory Rate (breaths/min)
                </label>
                <input
                  type="number"
                  value={vitals.respiratoryRate}
                  onChange={(e) => handleChange('respiratoryRate', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 18"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Oxygen Saturation (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={vitals.oxygenSaturation}
                  onChange={(e) => handleChange('oxygenSaturation', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 98"
                />
              </div>
            </div>
          </div>

          {/* Blood Glucose */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Blood Glucose</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  FBS - Fasting Blood Sugar (mg/dL)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={vitals.fbs}
                  onChange={(e) => handleChange('fbs', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 95"
                />
                <p className="text-xs text-slate-500 mt-1">Normal: 70-100 mg/dL</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  RBS - Random Blood Sugar (mg/dL)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={vitals.rbs}
                  onChange={(e) => handleChange('rbs', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300  focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 110"
                />
                <p className="text-xs text-slate-500 mt-1">Normal: &lt;140 mg/dL</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-slate-300  text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white  transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Recorded!</span>
                </>
              ) : (
                <span>Record Vitals</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
