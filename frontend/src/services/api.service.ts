/**
 * API Service - Replaces firestore.service.ts
 * Connects to FastAPI backend instead of Firebase
 */

// Detect if running in Tauri desktop app (supports both Tauri v1 and v2)
const isTauri = () => {
  if (typeof window === 'undefined') return false;
  // Tauri v2 uses __TAURI_INTERNALS__, v1 uses __TAURI__
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
};

// In Tauri, connect to local backend; otherwise use configured URL or proxy
const API_BASE_URL = isTauri()
  ? 'http://localhost:8080'
  : (import.meta.env.VITE_API_URL || '/api');

// Debug logging
if (typeof window !== 'undefined') {
  console.log('[API] Tauri detected:', isTauri(), '| Base URL:', API_BASE_URL);
}

interface ApiResponse<T> {
  data: T;
  status: number;
}

// AI Analytics types
export interface AIAnalyticsResponse {
  question: string;
  sql: string;
  data: Record<string, any>[];
  chart: {
    type: 'bar' | 'line' | 'pie' | 'area' | 'table';
    title: string;
    xKey?: string;
    yKey?: string;
    nameKey?: string;
    valueKey?: string;
  } | null;
  explanation: string | null;
  row_count: number;
}

export interface AIAnalyticsSchemaResponse {
  schema: string;
  supported_chart_types: string[];
  example_questions: string[];
}

export interface AIStatusResponse {
  model_loaded: boolean;
  is_multimodal: boolean;
  model_path: string;
  mmproj_path: string;
}

export interface PatientSummaryRequest {
  patient: {
    name: string;
    age: number | string;
    gender: string;
  };
  vitals?: Array<{ display?: string; name?: string; value?: any; unit?: string }>;
  medications?: Array<{ drugName?: string; name?: string; dosage?: string; frequency?: string }>;
  labResults?: Array<{ testType?: string; name?: string; resultValue?: string; value?: string; resultUnit?: string; unit?: string }>;
  diagnoses?: Array<{ conditionText?: string; name?: string; certainty?: string }>;
  encounters?: Array<{ encounterType?: { display?: string }; type?: string; encounterDatetime?: string; date?: string }>;
  allergies?: Array<{ allergen?: string; name?: string }>;
}

export interface PatientSummaryResponse {
  summary: string;
  generated_at: string;
  disclaimer: string;
}

// Document Scanning types
export interface ExtractedField {
  value: string | string[] | null;
  confidence: number;
}

export interface DocumentScanRequest {
  image_base64: string;
  document_type: 'auto' | 'ghana_card' | 'paper_record';
}

// FHIR R4 Patient resource (simplified)
export interface FHIRPatient {
  resourceType: 'Patient';
  identifier?: Array<{
    system?: string;
    value?: string;
    _confidence?: number;
  }>;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
    _confidence?: number;
  }>;
  gender?: string;
  _gender_confidence?: number;
  birthDate?: string;
  _birthDate_confidence?: number;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
    _confidence?: number;
  }>;
  address?: Array<{
    use?: string;
    city?: string;
    district?: string;
    state?: string;
    _confidence?: number;
  }>;
  contact?: Array<{
    relationship?: Array<{ text?: string }>;
    name?: { text?: string };
    telecom?: Array<{ system?: string; value?: string }>;
    _confidence?: number;
  }>;
}

export interface DocumentScanResponse {
  success: boolean;
  document_type?: string;
  confidence?: number;
  fhir_patient?: FHIRPatient;  // FHIR R4 Patient resource
  extracted_data?: {  // Legacy format for UI compatibility
    first_name?: ExtractedField;
    middle_name?: ExtractedField;
    last_name?: ExtractedField;
    gender?: ExtractedField;
    birthdate?: ExtractedField;
    phone_number?: ExtractedField;
    ghana_card_number?: ExtractedField;
    nhis_number?: ExtractedField;
    city?: ExtractedField;
    community?: ExtractedField;
    region?: ExtractedField;
    address?: ExtractedField;
    emergency_contact?: ExtractedField;
    medical_conditions?: ExtractedField;
    allergies?: ExtractedField;
    // Vitals
    blood_pressure?: ExtractedField;
    pulse?: ExtractedField;
    temperature?: ExtractedField;
    weight?: ExtractedField;
    height?: ExtractedField;
    spo2?: ExtractedField;
    // Medications
    current_medications?: ExtractedField;
    // Allow dynamic keys for additional fields
    [key: string]: ExtractedField | undefined;
  };
  raw_text?: string;
  notes?: string;
  error?: string;
}

// Request/Response for creating patient from scan
export interface PatientFromScanRequest {
  // Demographics
  first_name: string;
  middle_name?: string;
  last_name: string;
  gender: string;  // 'M' or 'F' or 'male'/'female'
  birthdate?: string;  // YYYY-MM-DD
  phone_number?: string;
  ghana_card_number?: string;
  nhis_number?: string;
  community?: string;
  city?: string;
  region?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;

  // Medical data
  medical_conditions?: string[];
  allergies?: string[];

  // Vitals
  blood_pressure?: string;  // "120/80"
  pulse?: string;  // "72 bpm"
  temperature?: string;  // "36.8 C"
  weight?: string;  // "68 kg"
  height?: string;  // "165 cm"
  spo2?: string;  // "98 %"

  // Medications
  current_medications?: string[];
}

export interface PatientFromScanResponse {
  success: boolean;
  patient_id: string;
  identifier: string;
  message: string;
  created: {
    patient: boolean;
    diagnoses: number;
    allergies: number;
    observations: number;
    medications: number;
  };
}

class ApiService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Load tokens from localStorage on init
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  // ============================================================================
  // HTTP HELPERS
  // ============================================================================

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry request with new token
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retryResponse = await fetch(url, { ...options, headers });
        if (!retryResponse.ok) {
          throw new Error(`API Error: ${retryResponse.status}`);
        }
        return retryResponse.json();
      }
      // Refresh failed, redirect to login (but not if already on login page)
      this.logout();
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/admin/login';
      }
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  private async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  private async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  private async put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  private async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  async login(username: string, password: string) {
    // Login endpoint should not go through the normal request method
    // to avoid token refresh logic on 401 (we want the actual error message)
    const url = `${API_BASE_URL}/auth/login`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Invalid username or password');
    }

    const data = await response.json();

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);

    // Get user info
    const user = await this.getCurrentUser();
    return user;
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  async getCurrentUser() {
    return this.get<{
      id: string;
      username: string;
      email: string | null;
      display_name: string;
      role: string;
      active: boolean;
    }>('/auth/me');
  }

  // Patient OTP Authentication
  async verifyPatientIdentity(firstName: string, lastName: string, birthdate: string) {
    return this.post<{
      verification_id: string;
      patient_id: string;
      phone_number: string | null;
      message: string;
    }>('/auth/patient/verify', { first_name: firstName, last_name: lastName, birthdate });
  }

  async sendOTP(verificationId: string, phoneNumber?: string, email?: string) {
    return this.post<{ message: string; verification_id: string; otp?: string }>(
      '/auth/patient/otp/send',
      { verification_id: verificationId, phone_number: phoneNumber, email }
    );
  }

  async verifyOTP(verificationId: string, otp: string) {
    return this.post<{
      access_token: string;
      token_type: string;
      patient_id: string;
      patient_name: string;
    }>('/auth/patient/otp/verify', { verification_id: verificationId, otp });
  }

  // ============================================================================
  // PATIENTS
  // ============================================================================

  /**
   * Transform patient data from snake_case (backend) to camelCase (frontend)
   */
  private transformPatientResponse(patient: any): any {
    if (!patient) return patient;
    return {
      ...patient,
      // Map snake_case to camelCase
      firstName: patient.first_name || patient.firstName || '',
      middleName: patient.middle_name || patient.middleName || '',
      lastName: patient.last_name || patient.lastName || '',
      phoneNumber: patient.phone_number || patient.phoneNumber || '',
      nationalId: patient.national_id || patient.nationalId || '',
      ghanaCardNumber: patient.ghana_card_number || patient.ghanaCardNumber || '',
      nhisNumber: patient.nhis_number || patient.nhisNumber || '',
      emergencyContactName: patient.emergency_contact_name || patient.emergencyContactName || '',
      emergencyContactPhone: patient.emergency_contact_phone || patient.emergencyContactPhone || '',
      emergencyContactRelationship: patient.emergency_contact_relationship || patient.emergencyContactRelationship || '',
      maritalStatus: patient.marital_status || patient.maritalStatus || '',
      educationLevel: patient.education_level || patient.educationLevel || '',
      dateOfBirth: patient.birthdate || patient.dateOfBirth || patient.date_of_birth || '',
      birthdate: patient.birthdate || patient.date_of_birth || '',
      createdAt: patient.created_at || patient.createdAt || '',
      updatedAt: patient.updated_at || patient.updatedAt || '',
      // Keep original fields for compatibility
      first_name: patient.first_name,
      last_name: patient.last_name,
    };
  }

  async getPatient(patientId: string) {
    const patient = await this.get<any>(`/patients/${patientId}`);
    return this.transformPatientResponse(patient);
  }

  async searchPatients(searchQuery: string) {
    const patients = await this.get<any[]>(`/patients/search?q=${encodeURIComponent(searchQuery)}`);
    return patients.map((p: any) => this.transformPatientResponse(p));
  }

  async getAllPatients(pageLimit: number = 100, startIndex: number = 0, community: string | null = null) {
    let url = `/patients?limit=${pageLimit}&offset=${startIndex}`;
    if (community) {
      url += `&community=${encodeURIComponent(community)}`;
    }
    const response = await this.get<{ results: any[]; count: number; total_count: number }>(url);
    return {
      ...response,
      results: response.results.map((p: any) => this.transformPatientResponse(p)),
      totalCount: response.total_count || response.count || 0,
    };
  }

  /**
   * Generate a unique patient identifier with Luhn check digit
   */
  async generateIdentifier(): Promise<string> {
    try {
      // Get total patient count to generate next ID
      const result = await this.get<{ results: any[]; total_count: number }>('/patients?limit=1&offset=0');
      const totalCount = result.total_count || 0;

      // Generate identifier: starting at 100000 + count
      const nextNumber = 100000 + totalCount;
      const checkDigit = this.calculateLuhnCheckDigit(nextNumber.toString());
      return `${nextNumber}${checkDigit}`;
    } catch (error) {
      // Fallback: generate based on timestamp
      const timestamp = Date.now().toString().slice(-6);
      const checkDigit = this.calculateLuhnCheckDigit(timestamp);
      return `${timestamp}${checkDigit}`;
    }
  }

  /**
   * Calculate Luhn check digit for identifier
   */
  private calculateLuhnCheckDigit(identifier: string): string {
    const digits = identifier.split('').map(Number);
    let sum = 0;
    let isEven = true;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = digits[i];
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      sum += digit;
      isEven = !isEven;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit.toString();
  }

  async registerPatient(patientData: any) {
    // Transform frontend data format to API format
    const apiData = {
      first_name: patientData.firstName,
      middle_name: patientData.middleName,
      last_name: patientData.lastName,
      gender: patientData.gender,
      birthdate: patientData.birthdate,
      birthdate_estimated: patientData.birthdateEstimated || false,
      phone_number: patientData.phoneNumber,
      email: patientData.email,
      national_id: patientData.nationalId,
      community: patientData.community,
      religion: patientData.religion,
      occupation: patientData.occupation,
      marital_status: patientData.maritalStatus,
      education_level: patientData.educationLevel,
      emergency_contact_name: patientData.emergencyContactName,
      emergency_contact_phone: patientData.emergencyContactPhone,
      emergency_contact_relationship: patientData.emergencyContactRelationship,
      ghana_card_number: patientData.ghanaCardNumber,
      nhis_number: patientData.nhisNumber,
      address: patientData.address,
    };
    return this.post<any>('/patients', apiData);
  }

  async updatePatient(patientId: string, updates: any) {
    return this.put<any>(`/patients/${patientId}`, updates);
  }

  async deletePatient(patientId: string) {
    return this.delete<void>(`/patients/${patientId}`);
  }

  async getCommunities() {
    return this.get<string[]>('/patients/communities');
  }

  async getCompletePatientData(patientId: string) {
    return this.get<any>(`/patients/${patientId}/complete`);
  }

  // ============================================================================
  // VISITS
  // ============================================================================

  async getPatientVisits(patientId: string) {
    return this.get<any[]>(`/visits?patient_id=${patientId}`);
  }

  async createVisit(visitData: any) {
    return this.post<any>('/visits', {
      patient_id: visitData.patientId,
      visit_type: visitData.visitType || 'Outpatient',
      location: visitData.location || 'OKB Clinic',
    });
  }

  async updateVisit(visitId: string, updates: any) {
    return this.put<any>(`/visits/${visitId}`, updates);
  }

  // ============================================================================
  // ENCOUNTERS
  // ============================================================================

  async getPatientEncounters(patientId: string) {
    return this.get<any[]>(`/encounters?patient_id=${patientId}`);
  }

  async createEncounter(encounterData: any) {
    return this.post<any>('/encounters', {
      patient_id: encounterData.patientId,
      visit_id: encounterData.visitId,
      encounter_type: encounterData.encounterType,
      location: encounterData.location,
      notes: encounterData.notes,
      diagnosis: encounterData.diagnosis,
      structured_data: encounterData.structuredData,
      vitals_data: encounterData.vitalsData,
    });
  }

  async updateEncounter(encounterId: string, updates: any) {
    return this.put<any>(`/encounters/${encounterId}`, updates);
  }

  // ============================================================================
  // OBSERVATIONS (Vitals & Lab Results)
  // ============================================================================

  async getPatientObservations(patientId: string, conceptType?: string) {
    let url = `/observations?patient_id=${patientId}`;
    if (conceptType) {
      url += `&concept_type=${conceptType}`;
    }
    return this.get<any[]>(url);
  }

  async getVitalSigns(patientId: string) {
    return this.get<any[]>(`/observations/vitals/${patientId}`);
  }

  async getLabResults(patientId: string) {
    return this.get<any[]>(`/observations/lab-results/${patientId}`);
  }

  async createObservation(obsData: any) {
    return this.post<any>('/observations', {
      patient_id: obsData.patientId,
      encounter_id: obsData.encounterId,
      visit_id: obsData.visitId,
      concept_type: obsData.conceptType,
      concept_code: obsData.conceptCode,
      concept_display: obsData.conceptDisplay,
      value_type: obsData.valueType,
      value_numeric: obsData.valueNumeric,
      value_text: obsData.valueText,
      value_coded: obsData.valueCoded,
      unit: obsData.unit,
      extra_data: obsData.extraData,
    });
  }

  // ============================================================================
  // MEDICATIONS
  // ============================================================================

  async getPatientMedications(patientId: string) {
    return this.get<any[]>(`/medications?patient_id=${patientId}`);
  }

  async createMedication(medicationData: any) {
    return this.post<any>('/medications', {
      patient_id: medicationData.patientId,
      encounter_id: medicationData.encounterId,
      drug_name: medicationData.drugName,
      drug_code: medicationData.drugCode,
      dosage: medicationData.dosage,
      dosage_unit: medicationData.dosageUnit || 'mg',
      frequency: medicationData.frequency,
      route: medicationData.route || 'Oral',
      duration: medicationData.duration,
      duration_unit: medicationData.durationUnit || 'days',
      quantity: medicationData.quantity,
      instructions: medicationData.instructions,
      create_pharmacy_order: medicationData.createPharmacyOrder !== false,
    });
  }

  // ============================================================================
  // DIAGNOSES
  // ============================================================================

  async getPatientDiagnoses(patientId: string) {
    return this.get<any[]>(`/diagnoses?patient_id=${patientId}`);
  }

  async addDiagnosis(diagnosisData: any) {
    return this.post<any>('/diagnoses', {
      patient_id: diagnosisData.patientId,
      encounter_id: diagnosisData.encounterId,
      condition_text: diagnosisData.condition || diagnosisData.conditionText,
      condition_code: diagnosisData.conditionCode,
      certainty: diagnosisData.certainty || 'confirmed',
      rank: diagnosisData.rank || 1,
      notes: diagnosisData.notes,
    });
  }

  async searchDiagnoses(searchTerm: string) {
    return this.get<any[]>(`/diagnoses/search?q=${encodeURIComponent(searchTerm)}`);
  }

  // ============================================================================
  // LAB ORDERS
  // ============================================================================

  async getLabOrders(status?: string, priority?: string) {
    let url = '/lab-orders';
    const params = new URLSearchParams();
    if (status) params.append('status_filter', status);
    if (priority) params.append('priority', priority);
    if (params.toString()) url += `?${params.toString()}`;
    return this.get<any[]>(url);
  }

  async getPatientLabOrders(patientId: string) {
    return this.get<any[]>(`/lab-orders?patient_id=${patientId}`);
  }

  async createLabOrder(orderData: any) {
    return this.post<any>('/lab-orders', {
      patient_id: orderData.patientId,
      test_type: orderData.testType,
      test_code: orderData.testCode,
      priority: orderData.priority || 'routine',
      notes: orderData.notes,
    });
  }

  async updateLabOrder(orderId: string, updates: any) {
    return this.put<any>(`/lab-orders/${orderId}`, updates);
  }

  async deleteLabOrder(orderId: string) {
    return this.delete<void>(`/lab-orders/${orderId}`);
  }

  // Polling-based subscription (replaces Firestore onSnapshot)
  subscribeToPatientLabOrders(
    patientId: string,
    callback: (orders: any[]) => void,
    intervalMs: number = 5000
  ): () => void {
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const orders = await this.getPatientLabOrders(patientId);
        callback(orders);
      } catch (error) {
        console.error('Lab orders polling error:', error);
      }
      if (active) {
        setTimeout(poll, intervalMs);
      }
    };

    poll();

    // Return unsubscribe function
    return () => {
      active = false;
    };
  }

  // ============================================================================
  // PHARMACY ORDERS
  // ============================================================================

  async getPharmacyOrders(status?: string) {
    let url = '/pharmacy-orders';
    if (status) url += `?status_filter=${status}`;
    return this.get<any[]>(url);
  }

  async getPatientPharmacyOrders(patientId: string) {
    return this.get<any[]>(`/pharmacy-orders?patient_id=${patientId}`);
  }

  async createPharmacyOrder(orderData: any) {
    return this.post<any>('/pharmacy-orders', {
      patient_id: orderData.patientId,
      medication_id: orderData.medicationId,
      drug_name: orderData.drugName,
      dosage: orderData.dosage,
      quantity: orderData.quantity,
      notes: orderData.notes,
    });
  }

  async updatePharmacyOrder(orderId: string, updates: any) {
    return this.put<any>(`/pharmacy-orders/${orderId}`, updates);
  }

  async deletePharmacyOrder(orderId: string) {
    return this.delete<void>(`/pharmacy-orders/${orderId}`);
  }

  // Polling-based subscription
  subscribeToPatientPharmacyOrders(
    patientId: string,
    callback: (orders: any[]) => void,
    intervalMs: number = 5000
  ): () => void {
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const orders = await this.getPatientPharmacyOrders(patientId);
        callback(orders);
      } catch (error) {
        console.error('Pharmacy orders polling error:', error);
      }
      if (active) {
        setTimeout(poll, intervalMs);
      }
    };

    poll();

    return () => {
      active = false;
    };
  }

  // ============================================================================
  // USERS
  // ============================================================================

  async getUsers() {
    return this.get<any[]>('/users');
  }

  async createUser(userData: any) {
    return this.post<any>('/users', userData);
  }

  async updateUser(userId: string, updates: any) {
    return this.put<any>(`/users/${userId}`, updates);
  }

  async deleteUser(userId: string) {
    return this.delete<void>(`/users/${userId}`);
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  async getAnalytics(timeRange: string = 'week') {
    const data = await this.get<any>(`/analytics?time_range=${timeRange}`);

    // Calculate percentages for disease stats
    const totalDiagnoses = (data.top_diagnoses || []).reduce((sum: number, d: any) => sum + (d.count || 0), 0);

    // Transform backend snake_case response to frontend camelCase format
    return {
      totalPatients: data.total_patients || 0,
      recentPatients: data.patients_today || 0,
      activeVisits: data.visits_today || 0,
      totalVisits: data.total_visits || 0,
      totalEncounters: data.total_encounters || 0,
      activePatients: data.active_patients || 0,
      diseaseStats: (data.top_diagnoses || []).map((d: any) => ({
        disease: d.condition || 'Unknown',
        count: d.count || 0,
        percentage: totalDiagnoses > 0 ? ((d.count || 0) / totalDiagnoses) * 100 : 0,
      })),
      communityStats: (data.community_distribution || []).map((c: any) => ({
        community: c.community || 'Unknown',
        patientCount: c.patient_count || 0,
        diseases: [],
      })),
      trendData: (data.visits_over_time || []).map((v: any) => ({
        date: v.date || '',
        patients: 0,
        visits: v.count || 0,
      })),
      ageGroups: Object.entries(data.age_distribution || {}).map(([ageGroup, count]) => ({
        ageGroup,
        count: count as number,
      })),
      genderStats: Object.entries(data.gender_distribution || {}).map(([gender, count]) => ({
        gender: gender || 'Unknown',
        count: count as number,
      })),
      // NEW: Trend comparisons for KPI cards
      patientTrend: data.patient_trend ? {
        current: data.patient_trend.current,
        previous: data.patient_trend.previous,
        changePercent: data.patient_trend.change_percent,
      } : null,
      visitTrend: data.visit_trend ? {
        current: data.visit_trend.current,
        previous: data.visit_trend.previous,
        changePercent: data.visit_trend.change_percent,
      } : null,
      encounterTrend: data.encounter_trend ? {
        current: data.encounter_trend.current,
        previous: data.encounter_trend.previous,
        changePercent: data.encounter_trend.change_percent,
      } : null,
      // NEW: Department/location stats
      departmentStats: (data.department_stats || []).map((d: any) => ({
        department: d.department || 'Unknown',
        count: d.count || 0,
      })),
      // NEW: Staff statistics
      staffStats: data.staff_stats ? {
        total: data.staff_stats.total || 0,
        active: data.staff_stats.active || 0,
        byRole: data.staff_stats.by_role || {},
      } : null,
      // NEW: Lab and pharmacy order stats
      labOrderStats: data.lab_order_stats || {},
      pharmacyOrderStats: data.pharmacy_order_stats || {},
    };
  }

  async getRealDiagnosisData() {
    return this.get<any[]>('/analytics/disease-stats');
  }

  // ============================================================================
  // CATALOGS
  // ============================================================================

  async getMedications() {
    return this.get<any[]>('/catalogs/medications');
  }

  async getLabTests() {
    return this.get<any[]>('/catalogs/lab-tests');
  }

  async getDiagnosisConcepts() {
    return this.get<any[]>('/catalogs/diagnoses');
  }

  async initializeCatalogs() {
    return this.post<any>('/catalogs/initialize');
  }

  // ============================================================================
  // AI ANALYTICS
  // ============================================================================

  async aiAnalyticsQuery(question: string): Promise<AIAnalyticsResponse> {
    return this.post<AIAnalyticsResponse>('/ai/analytics/query', { question });
  }

  async getAIAnalyticsSchema(): Promise<AIAnalyticsSchemaResponse> {
    return this.get<AIAnalyticsSchemaResponse>('/ai/analytics/schema');
  }

  async getAIStatus(): Promise<AIStatusResponse> {
    return this.get<AIStatusResponse>('/ai/status');
  }

  async generatePatientSummary(request: PatientSummaryRequest): Promise<PatientSummaryResponse> {
    return this.post<PatientSummaryResponse>('/ai/patient/summary', request);
  }

  async chat(request: {
    prompt: string;
    system_prompt?: string;
    max_tokens?: number;
    temperature?: number;
  }): Promise<{ response: string; model_loaded: boolean }> {
    return this.post<{ response: string; model_loaded: boolean }>('/ai/chat', request);
  }

  /**
   * Query the EHR Agent Navigator with a natural language question.
   * The agent will classify needed data tables, query the database, and synthesize a response.
   *
   * @param question - Natural language question about the patient
   * @param patient_id - UUID of the patient
   * @param conversation_history - Optional previous messages for multi-turn conversation
   * @returns Clinical response with tool calls and metadata
   */
  async ehrAgentQuery(request: {
    question: string;
    patient_id: string;
    conversation_history?: Array<{ role: string; content: string }>;
  }): Promise<{
    response: string;
    tool_calls: Array<{ tool: string; arguments: Record<string, any>; result_summary?: string }>;
    iterations: number;
    patient_id: string;
    timestamp: string;
    disclaimer: string;
    error?: boolean;
  }> {
    return this.post('/ai/agent/query', request);
  }

  /**
   * Stream the EHR Agent Navigator response with real-time token updates.
   * Uses Server-Sent Events (SSE) for streaming.
   *
   * @param question - Natural language question about the patient
   * @param patient_id - UUID of the patient
   * @param conversation_history - Optional previous messages for multi-turn conversation
   * @param onStatus - Callback for status updates (analyzing, fetching data)
   * @param onToolCall - Callback for tool call events (which tables are being queried)
   * @param onContent - Callback for streaming content tokens
   * @param onDone - Callback when streaming is complete
   * @param onError - Callback for errors
   */
  async ehrAgentQueryStream(
    request: {
      question: string;
      patient_id: string;
      conversation_history?: Array<{ role: string; content: string }>;
    },
    callbacks: {
      onStatus?: (status: string) => void;
      onToolCall?: (tool: string, table: string, result: string) => void;
      onContent?: (content: string) => void;
      onDone?: (data: {
        iterations: number;
        tool_calls: Array<{ tool: string; arguments: Record<string, any>; result_summary?: string }>;
        timestamp: string;
        disclaimer: string;
      }) => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    // Try access_token first (admin login), then auth_token (legacy)
    const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    if (!token) {
      callbacks.onError?.('Not authenticated - please log in again');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/ai/agent/query/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        callbacks.onError?.(errorText || `HTTP ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError?.('No response body');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const data = line.slice(6).trim(); // Remove 'data: ' prefix
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case 'status':
                callbacks.onStatus?.(event.content);
                break;
              case 'tool_call':
                callbacks.onToolCall?.(event.tool, event.table, event.result);
                break;
              case 'response_start':
                // Signal that content is starting
                break;
              case 'content':
                callbacks.onContent?.(event.content);
                break;
              case 'done':
                callbacks.onDone?.({
                  iterations: event.iterations,
                  tool_calls: event.tool_calls,
                  timestamp: event.timestamp,
                  disclaimer: event.disclaimer,
                });
                break;
              case 'error':
                callbacks.onError?.(event.content);
                break;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error.message : 'Stream failed');
    }
  }

  // ============================================================================
  // DOCUMENT SCANNING (OCR)
  // ============================================================================

  /**
   * Scan a document (Ghana Card or paper record) and extract patient data.
   * Uses multimodal AI to detect document type and extract structured data.
   *
   * @param image_base64 - Base64-encoded image of the document
   * @param document_type - Type hint: 'auto', 'ghana_card', or 'paper_record'
   * @returns Extracted patient data with confidence scores
   */
  async scanDocument(
    image_base64: string,
    document_type: 'auto' | 'ghana_card' | 'paper_record' = 'auto'
  ): Promise<DocumentScanResponse> {
    return this.post<DocumentScanResponse>('/ai/scan-document', {
      image_base64,
      document_type,
    });
  }

  /**
   * Create a patient directly from scanned document data.
   * Creates patient + diagnoses + allergies + vitals + medications in one transaction.
   *
   * @param data - Extracted patient data from document scan
   * @returns Created patient info
   */
  async createPatientFromScan(data: PatientFromScanRequest): Promise<PatientFromScanResponse> {
    return this.post<PatientFromScanResponse>('/patients/from-scan', data);
  }

  // ============================================================================
  // UTILITY METHODS (for compatibility with firestore.service.ts)
  // ============================================================================

  // Calculate age from birthdate (moved from service to utility)
  calculateAge(birthdate: Date | string): number {
    const birth = typeof birthdate === 'string' ? new Date(birthdate) : birthdate;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
