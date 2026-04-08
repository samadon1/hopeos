"use client"

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Eye,
  User,
  MapPin,
  Calendar,
  Phone,
  Filter,
  Loader2,
  AlertCircle,
  CreditCard,
  Users,
  RefreshCw,
  X,
} from 'lucide-react';
import apiService from '../../services/api.service';
import { Patient } from '../../types';
import { cache } from '../../utils/cache';
import { debounce } from '../../utils/debounce';
import PatientListSkeleton from './PatientListSkeleton';

export default function PatientSearch() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'identifier' | 'phone'>('name');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [communities, setCommunities] = useState<string[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<string>('all');
  const [showReferredOnly, setShowReferredOnly] = useState(false);
  const [showFollowUpOnly, setShowFollowUpOnly] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25); // Show 25 patients per page

  const loadAllPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first (10 minute TTL for patient list - optimized for performance)
      const cacheKey = `patients_${selectedCommunity}`;
      const cachedData = cache.get<{ results: Patient[]; totalCount: number }>(cacheKey);

      if (cachedData) {
        console.log('📦 Using cached patient data');
        setAllPatients(cachedData.results);
        
        // Apply filters if enabled
        let filteredResults = cachedData.results;
        if (showReferredOnly) {
          filteredResults = filteredResults.filter((patient: any) => patient.referred === true);
        }
        if (showFollowUpOnly) {
          filteredResults = filteredResults.filter((patient: any) => patient.needsFollowUp === true);
        }

        setPatients(filteredResults);
        setTotalCount(cachedData.totalCount);
        setLoading(false);
        return;
      }

      console.log('🔄 Fetching fresh patient data from Firestore...');

      const result = await apiService.getAllPatients(
        100,
        0,
        selectedCommunity === 'all' ? null : selectedCommunity
      );

      // Cache the result (10 minutes - patient data doesn't change frequently)
      cache.set(cacheKey, result, 10 * 60 * 1000); // 10 minutes

      setAllPatients(result.results);

      // Apply filters if enabled
      let filteredResults = result.results;
      if (showReferredOnly) {
        filteredResults = filteredResults.filter((patient: any) => patient.referred === true);
      }
      if (showFollowUpOnly) {
        filteredResults = filteredResults.filter((patient: any) => patient.needsFollowUp === true);
      }

      setPatients(filteredResults);
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error('Error loading all patients:', err);
      setError('Failed to load patients. Please try again.');
      setPatients([]);
      setAllPatients([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCommunity, showReferredOnly, showFollowUpOnly]);

  const loadCommunities = useCallback(async () => {
    try {
      // Check cache first (10 minute TTL for communities - rarely changes)
      const cacheKey = 'communities';
      const cachedCommunities = cache.get<string[]>(cacheKey);

      if (cachedCommunities) {
        console.log('📦 Using cached communities');
        setCommunities(cachedCommunities);
        return;
      }

      console.log('🔄 Fetching communities from Firestore...');
      const communityList = await apiService.getCommunities();

      // Cache the result
      cache.set(cacheKey, communityList, 10 * 60 * 1000); // 10 minutes

      setCommunities(communityList);
    } catch (err) {
      console.error('Error loading communities:', err);
    }
  }, []);

  // Load all patients and communities on mount
  useEffect(() => {
    loadAllPatients();
    loadCommunities();
  }, [loadAllPatients, loadCommunities]);

  // Reload patients when community filter changes (already handled by loadAllPatients dependency)

  // Client-side search for better performance (when we have all patients loaded)
  const handleClientSideSearch = useCallback((query: string) => {
    let filtered = allPatients;

    // Apply filters first
    if (showReferredOnly) {
      filtered = filtered.filter((patient: any) => patient.referred === true);
    }
    if (showFollowUpOnly) {
      filtered = filtered.filter((patient: any) => patient.needsFollowUp === true);
    }

    // Apply search query if provided
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter((patient: any) => {
        if (searchType === 'name') {
          // Firestore structure: firstName, lastName (flat)
          const fullName = `${patient.firstName || ''} ${patient.middleName || ''} ${patient.lastName || ''}`.toLowerCase();
          return fullName.includes(lowerQuery);
        } else if (searchType === 'identifier') {
          // Search in multiple identifier fields
          const identifiers = [
            patient.identifier,
            patient.ghanaCardNumber,
            patient.nhisNumber,
            patient.nationalId,
          ].filter(Boolean).map((id: string) => id.toLowerCase());
          return identifiers.some((id: string) => id.includes(lowerQuery));
        } else if (searchType === 'phone') {
          // Firestore structure: phoneNumber (flat)
          const phoneNumber = (patient.phoneNumber || '').toLowerCase();
          return phoneNumber.includes(lowerQuery);
        }
        return false;
      });
    }

    setPatients(filtered);
    if (filtered.length === 0) {
      if (showReferredOnly && !query.trim()) {
        setError('No referred patients found');
      } else if (showReferredOnly && query.trim()) {
        setError('No referred patients found matching your search criteria');
      } else if (showFollowUpOnly && !query.trim()) {
        setError('No patients needing follow-up found');
      } else if (showFollowUpOnly && query.trim()) {
        setError('No follow-up patients found matching your search criteria');
      } else if (query.trim()) {
        setError('No patients found matching your search criteria');
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
  }, [allPatients, searchType, showReferredOnly, showFollowUpOnly]);

  // Debounced search (300ms delay)
  const debouncedSearch = useMemo(
    () => debounce((query: string) => handleClientSideSearch(query), 300),
    [handleClientSideSearch]
  );

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  // Apply filters when referred filter changes or when patients are loaded
  useEffect(() => {
    if (allPatients.length > 0) {
      handleClientSideSearch(searchQuery);
    }
  }, [showReferredOnly]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    // If we have patients loaded, use client-side search
    if (allPatients.length > 0) {
      handleClientSideSearch(searchQuery);
      return;
    }

    // Otherwise, fall back to server search
    try {
      setLoading(true);
      setError(null);

      const results = await apiService.searchPatients(searchQuery, searchType);
      setPatients(results);

      if (results.length === 0) {
        setError('No patients found matching your search criteria');
      }
    } catch (err) {
      console.error('Error searching patients:', err);
      setError('Failed to search patients. Please try again.');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleViewDetails = (patient: Patient) => {
    // Use 'id' from Firestore (document ID) instead of 'uuid'
    const patientId = (patient as any).id || patient.uuid;
    navigate(`/admin/patient-portal/${patientId}`, {
      state: { patient }
    });
  };

  const getAge = (birthdate: string) => {
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Paginate patients
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return patients.slice(start, end);
  }, [patients, currentPage, pageSize]);

  // Calculate pagination stats
  const totalPages = Math.ceil(patients.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, patients.length);

  // Reset to page 1 when search results change
  useEffect(() => {
    setCurrentPage(1);
  }, [patients]);

  if (loading && patients.length === 0) {
    return <PatientListSkeleton />;
  }

  return (
    <div className="space-y-5">
      {/* Loading Progress Bar */}
      {loading && (
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-olive-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
      )}

      {/* Search and Filter Section */}
      <div className="bg-white border border-gray-100 overflow-hidden rounded-2xl shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Search Patients</h2>
          <p className="text-sm text-gray-600 mt-0.5">Find patients by name, ID, or phone number</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Community Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Filter by Community
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={selectedCommunity}
                  onChange={(e) => setSelectedCommunity(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500 bg-white transition-colors"
                >
                  <option value="all">All Communities</option>
                  {communities.map((community) => (
                    <option key={community} value={community}>
                      {community}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Patient Status Filters */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Patient Status
              </label>
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <label className="flex items-center pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white transition-colors cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={showReferredOnly}
                      onChange={(e) => setShowReferredOnly(e.target.checked)}
                      className="w-4 h-4 text-olive-600 border-gray-300 rounded focus:ring-olive-500"
                    />
                    <span className="ml-3 text-gray-700">Show Referred Patients Only</span>
                  </label>
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <label className="flex items-center pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white transition-colors cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={showFollowUpOnly}
                      onChange={(e) => setShowFollowUpOnly(e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                    />
                    <span className="ml-3 text-gray-700">Show Follow-Up Patients Only</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Search Section */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Search By
            </label>
            <div className="flex gap-3">
              {/* Search Type Selector */}
              <div className="w-40">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as 'name' | 'identifier' | 'phone')}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500 bg-white transition-colors"
                >
                  <option value="name">Name</option>
                  <option value="identifier">Patient ID</option>
                  <option value="phone">Phone</option>
                </select>
              </div>

              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={
                    searchType === 'name'
                      ? 'Type patient name...'
                      : searchType === 'identifier'
                      ? 'Enter patient ID...'
                      : 'Enter phone number...'
                  }
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleKeyPress}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:border-olive-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setError(null);
                      setPatients(allPatients);
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Search updates automatically as you type</p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Results Section */}
      {patients.length > 0 && (
        <div>
          {/* Results Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {searchQuery ? 'Search Results' : 'All Patients'}
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Showing {startIndex}-{endIndex} of {patients.length} {patients.length === 1 ? 'patient' : 'patients'}
              </p>
            </div>
            <button
              onClick={loadAllPatients}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* Patient Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedPatients.map((patient: any) => {
              // Firestore structure: flat fields (firstName, lastName, gender, birthdate, community, etc.)
              const firstName = patient.firstName || '';
              const lastName = patient.lastName || '';
              const fullName = `${firstName} ${lastName}`.trim();
              const patientId = patient.identifier || patient.id || 'N/A';
              const age = patient.age || (patient.birthdate ? getAge(patient.birthdate.toDate ? patient.birthdate.toDate().toISOString() : patient.birthdate) : 0);
              const gender = patient.gender || 'U';
              const community = patient.community || null;
              const isDead = patient.dead || false;

              return (
                <div
                  key={patient.id || patient.identifier}
                  onClick={() => handleViewDetails(patient)}
                  className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 cursor-pointer"
                >
                  {/* Patient Header */}
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-olive-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-olive-700 font-semibold text-sm">
                          {firstName[0] || 'P'}
                          {lastName[0] || 'T'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-base truncate group-hover:text-olive-700 transition-colors">
                          {fullName || 'Unknown Patient'}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className={`h-2 w-2 rounded-full ${
                            isDead ? 'bg-gray-400' : 'bg-emerald-500'
                          }`} />
                          <span className="text-xs text-gray-500">
                            {isDead ? 'Deceased' : 'Active'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Patient Details */}
                  <div className="p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Patient ID</span>
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {patientId}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Age / Gender</span>
                      <span className="text-sm font-medium text-gray-900">
                        {age} yrs, {gender.toUpperCase()}
                      </span>
                    </div>

                    {community && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Community</span>
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[60%]">
                          {community}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* View Action (appears on hover) */}
                  <div className="px-5 pb-5">
                    <div className="flex items-center justify-between text-gray-600 group-hover:text-olive-700 transition-colors pt-3 border-t border-gray-100">
                      <span className="text-sm font-medium">View Details</span>
                      <Eye className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-6">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 text-sm font-medium rounded-xl transition-colors ${
                          currentPage === pageNum
                            ? 'bg-olive-500 text-white'
                            : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && patients.length === 0 && !error && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-olive-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-olive-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Patients Found</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery
              ? 'Try adjusting your search criteria or filters'
              : 'Use the search bar above to find patients'}
          </p>
        </div>
      )}
    </div>
  );
}
