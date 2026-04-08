"use client"

import { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle } from 'lucide-react';
import apiService from '../../services/api.service';

export default function DiagnosticPage() {
  const [loading, setLoading] = useState(true);
  const [personAttributes, setPersonAttributes] = useState<any[]>([]);
  const [addressTemplate, setAddressTemplate] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDiagnosticData();
  }, []);

  const fetchDiagnosticData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching diagnostic data...');

      // Fetch person attributes
      const attributes = await apiService.getFullPersonAttributeTypes();
      setPersonAttributes(attributes);

      // Fetch address template
      try {
        const template = await apiService.getAddressTemplate();
        setAddressTemplate(template);
      } catch (err) {
        console.warn('Address template not available:', err);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching diagnostic data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading OpenMRS Configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-2xl">
          <AlertCircle className="h-8 w-8 text-red-600 mb-3" />
          <h2 className="text-xl font-bold text-red-900 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center">
          <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
          OpenMRS Configuration Diagnostic
        </h1>
        <p className="text-slate-600">
          This page shows the actual OpenMRS configuration for your instance.
        </p>
      </div>

      {/* Person Attribute Types */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          Person Attribute Types ({personAttributes.length})
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          These are custom attributes available for patients (Community, Religion, Education, etc.)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-3 font-semibold">Display Name</th>
                <th className="text-left p-3 font-semibold">UUID</th>
                <th className="text-left p-3 font-semibold">Format</th>
                <th className="text-left p-3 font-semibold">Required</th>
              </tr>
            </thead>
            <tbody>
              {personAttributes.map((attr: any) => (
                <tr key={attr.uuid} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-900">{attr.display || attr.name}</td>
                  <td className="p-3 font-mono text-xs text-slate-600">{attr.uuid}</td>
                  <td className="p-3 text-slate-700">{attr.format}</td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                      attr.required
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {attr.required ? 'Required' : 'Optional'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Address Template */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Address Template</h2>
        <p className="text-sm text-slate-600 mb-4">
          This shows the address structure configured in OpenMRS
        </p>
        {addressTemplate ? (
          <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre>{JSON.stringify(addressTemplate, null, 2)}</pre>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700">
            Address template endpoint not available or using default OpenMRS address fields
          </div>
        )}
      </div>

      {/* Copy to Clipboard Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 mb-3">Copy Configuration</h3>
        <p className="text-sm text-blue-700 mb-3">
          Copy this data and share it to update the patient registration form:
        </p>
        <button
          onClick={() => {
            const data = {
              personAttributes: personAttributes.map(attr => ({
                name: attr.display || attr.name,
                uuid: attr.uuid,
                format: attr.format,
                required: attr.required
              })),
              addressTemplate: addressTemplate
            };
            navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            alert('Configuration copied to clipboard!');
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Copy to Clipboard
        </button>
      </div>
    </div>
  );
}
