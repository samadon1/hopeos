"use client"

import { useState } from 'react';
import { UserPlus, Users, Stethoscope } from 'lucide-react';
import PatientRegistration from '../components/admin/PatientRegistration';
import PatientSearch from '../components/admin/PatientSearch';

export default function NurseDashboard() {
  const [activeTab, setActiveTab] = useState<'search' | 'register'>('register');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 bg-gradient-to-br from-olive-500 to-olive-600 rounded-2xl flex items-center justify-center shadow-sm">
          <Stethoscope className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nurse Station</h1>
          <p className="text-gray-600">Register new patients and manage patient records</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border border-gray-100 overflow-hidden rounded-2xl shadow-sm">
        <div className="flex">
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all relative ${
              activeTab === 'register'
                ? 'text-olive-700 bg-olive-50/50'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2.5">
              <div className={`p-1.5 rounded-lg transition-colors ${
                activeTab === 'register' ? 'bg-olive-100' : 'bg-gray-100'
              }`}>
                <UserPlus className={`h-4 w-4 ${
                  activeTab === 'register' ? 'text-olive-600' : 'text-gray-500'
                }`} />
              </div>
              <span>Register Patient</span>
            </div>
            {activeTab === 'register' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-olive-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all relative ${
              activeTab === 'search'
                ? 'text-olive-700 bg-olive-50/50'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2.5">
              <div className={`p-1.5 rounded-lg transition-colors ${
                activeTab === 'search' ? 'bg-olive-100' : 'bg-gray-100'
              }`}>
                <Users className={`h-4 w-4 ${
                  activeTab === 'search' ? 'text-olive-600' : 'text-gray-500'
                }`} />
              </div>
              <span>Patient Records</span>
            </div>
            {activeTab === 'search' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-olive-500" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 border-t border-gray-100">
          {activeTab === 'search' && <PatientSearch />}
          {activeTab === 'register' && <PatientRegistration />}
        </div>
      </div>
    </div>
  );
}
