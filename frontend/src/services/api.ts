import axios, { AxiosInstance } from 'axios';
import { Patient, Encounter, Visit, Observation, User, FHIRPatient, FHIRObservation, FHIRMedicationRequest } from '../types';

class ApiService {
  private api: AxiosInstance;
  private readonly baseURL = import.meta.env.PROD 
    ? 'http://34.44.142.239/openmrs' // Your production OpenMRS URL
    : '/openmrs';

  constructor() {
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Important for OpenMRS session management
    });

    // Request interceptor for authentication
    this.api.interceptors.request.use(
      (config) => {
        // Add any auth headers if needed
        const token = localStorage.getItem('openmrs_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          localStorage.removeItem('openmrs_token');
          localStorage.removeItem('openmrs_user');
          // In production, redirect to OpenMRS login
          if (import.meta.env.PROD) {
            window.location.href = 'http://34.44.142.239/openmrs/spa/login';
          } else {
            window.location.href = '/login';
          }
        } else if (error.code === 'NETWORK_ERROR' || !error.response) {
          // Handle network errors (OpenMRS server down)
          console.error('OpenMRS server is not accessible:', error);
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async login(username: string, password: string): Promise<User> {
    const response = await this.api.post('/ws/rest/v1/session', {
      username,
      password,
    });
    
    if (response.data.authenticated) {
      // Store session info
      localStorage.setItem('openmrs_user', JSON.stringify(response.data.user));
      return response.data.user;
    }
    throw new Error('Authentication failed');
  }

  async logout(): Promise<void> {
    await this.api.delete('/ws/rest/v1/session');
    localStorage.removeItem('openmrs_user');
    localStorage.removeItem('openmrs_token');
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.api.get('/ws/rest/v1/session');
    return response.data.user;
  }

  // Patient REST API methods
  async getPatient(uuid: string): Promise<Patient> {
    const response = await this.api.get(`/ws/rest/v1/patient/${uuid}?v=full`);
    return response.data;
  }

  async searchPatients(query: string): Promise<Patient[]> {
    const response = await this.api.get(`/ws/rest/v1/patient?q=${encodeURIComponent(query)}&v=full`);
    return response.data.results;
  }

  async getPatientByIdentifier(identifier: string): Promise<Patient> {
    const response = await this.api.get(`/ws/rest/v1/patient?identifier=${identifier}&v=full`);
    if (response.data.results.length === 0) {
      throw new Error('Patient not found');
    }
    return response.data.results[0];
  }

  // Encounters
  async getPatientEncounters(patientUuid: string): Promise<Encounter[]> {
    const response = await this.api.get(`/ws/rest/v1/encounter?patient=${patientUuid}&v=full`);
    return response.data.results;
  }

  async getEncounter(uuid: string): Promise<Encounter> {
    const response = await this.api.get(`/ws/rest/v1/encounter/${uuid}?v=full`);
    return response.data;
  }

  // Visits
  async getPatientVisits(patientUuid: string): Promise<Visit[]> {
    const response = await this.api.get(`/ws/rest/v1/visit?patient=${patientUuid}&v=full`);
    return response.data.results;
  }

  // Observations
  async getPatientObservations(patientUuid: string, concept?: string): Promise<Observation[]> {
    let url = `/ws/rest/v1/obs?patient=${patientUuid}&v=full`;
    if (concept) {
      url += `&concept=${concept}`;
    }
    const response = await this.api.get(url);
    return response.data.results;
  }

  // FHIR API methods
  async getFHIRPatient(id: string): Promise<FHIRPatient> {
    const response = await this.api.get(`/ws/fhir2/R4/Patient/${id}`);
    return response.data;
  }

  async getFHIRObservations(patientId: string, code?: string): Promise<FHIRObservation[]> {
    let url = `/ws/fhir2/R4/Observation?patient=${patientId}`;
    if (code) {
      url += `&code=${code}`;
    }
    const response = await this.api.get(url);
    return response.data.entry?.map((entry: any) => entry.resource) || [];
  }

  async getFHIRMedicationRequests(patientId: string): Promise<FHIRMedicationRequest[]> {
    const response = await this.api.get(`/ws/fhir2/R4/MedicationRequest?patient=${patientId}`);
    return response.data.entry?.map((entry: any) => entry.resource) || [];
  }

  async getFHIREncounters(patientId: string): Promise<any[]> {
    const response = await this.api.get(`/ws/fhir2/R4/Encounter?patient=${patientId}`);
    return response.data.entry?.map((entry: any) => entry.resource) || [];
  }

  // Lab Results (using FHIR Observations with lab-specific codes)
  async getLabResults(patientId: string): Promise<FHIRObservation[]> {
    // Common lab test LOINC codes
    const labCodes = [
      '33747-0', // Basic metabolic panel
      '58410-2', // CBC panel
      '24323-8', // Comprehensive metabolic panel
      '57698-3', // Lipid panel
    ];
    
    const results: FHIRObservation[] = [];
    for (const code of labCodes) {
      try {
        const observations = await this.getFHIRObservations(patientId, code);
        results.push(...observations);
      } catch (error) {
        console.warn(`Failed to fetch lab results for code ${code}:`, error);
      }
    }
    
    return results.sort((a, b) => 
      new Date(b.effectiveDateTime).getTime() - new Date(a.effectiveDateTime).getTime()
    );
  }

  // Vital Signs
  async getVitalSigns(patientId: string): Promise<FHIRObservation[]> {
    const vitalCodes = [
      '8480-6',  // Systolic blood pressure
      '8462-4',  // Diastolic blood pressure
      '8867-4',  // Heart rate
      '8310-5',  // Body temperature
      '8302-2',  // Body height
      '29463-7', // Body weight
      '39156-5', // Body mass index
    ];

    const results: FHIRObservation[] = [];
    for (const code of vitalCodes) {
      try {
        const observations = await this.getFHIRObservations(patientId, code);
        results.push(...observations);
      } catch (error) {
        console.warn(`Failed to fetch vital signs for code ${code}:`, error);
      }
    }
    
    return results.sort((a, b) => 
      new Date(b.effectiveDateTime).getTime() - new Date(a.effectiveDateTime).getTime()
    );
  }

  // Appointments (if available)
  async getPatientAppointments(patientUuid: string): Promise<any[]> {
    try {
      const response = await this.api.get(`/ws/rest/v1/appointment?patient=${patientUuid}`);
      return response.data.results || [];
    } catch (error) {
      console.warn('Appointments module not available:', error);
      return [];
    }
  }

  // Admin Portal - Analytics (Real data from Firebase Function)
  async getAnalytics(timeRange: 'week' | 'month' | 'year'): Promise<any> {
    try {
      // Use production Cloud Functions
      const functionUrl = 'https://us-central1-okb-ehr.cloudfunctions.net/getAdminAnalytics';

      console.log('📡 Calling analytics function at:', functionUrl);

      // Call Firebase Function to get real analytics data from OpenMRS
      const response = await axios.post(
        functionUrl,
        { timeRange },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Analytics data received from Firebase Function:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching analytics from Firebase Function:', error);

      // Fallback to basic empty data if Firebase Function fails
      return {
        totalPatients: 0,
        recentPatients: 0,
        activeVisits: 0,
        diseaseStats: [],
        communityStats: [{ community: 'Error loading data', patientCount: 0, diseases: [] }],
      };
    }
  }

  // Admin Portal - Patient Search (using Firebase Functions for authentication)
  async adminSearchPatients(query: string, searchType: 'name' | 'identifier' | 'phone'): Promise<Patient[]> {
    try {
      const functionUrl = 'https://us-central1-okb-ehr.cloudfunctions.net/adminSearchPatients';

      const response = await axios.post(
        functionUrl,
        { query, searchType },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.results || [];
    } catch (error) {
      console.error('Error searching patients via Firebase Function:', error);
      throw error;
    }
  }

  // Admin Portal - Get All Patients with Pagination
  async getAllPatients(limit: number = 100, startIndex: number = 0, community: string | null = null): Promise<{ results: Patient[], count: number, totalCount: number }> {
    try {
      const functionUrl = 'https://us-central1-okb-ehr.cloudfunctions.net/getAllPatients';

      const response = await axios.post(
        functionUrl,
        { limit, startIndex, community },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        results: response.data.results || [],
        count: response.data.count || 0,
        totalCount: response.data.totalCount || 0
      };
    } catch (error) {
      console.error('Error getting all patients via Firebase Function:', error);
      throw error;
    }
  }

  // Admin Portal - Get Communities
  async getCommunities(): Promise<string[]> {
    try {
      const functionUrl = 'https://us-central1-okb-ehr.cloudfunctions.net/getCommunities';

      const response = await axios.post(
        functionUrl,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.communities || [];
    } catch (error) {
      console.error('Error getting communities via Firebase Function:', error);
      throw error;
    }
  }

  // Admin Portal - Get Real Diagnosis Data
  async getRealDiagnosisData(): Promise<any> {
    try {
      const functionUrl = 'https://us-central1-okb-ehr.cloudfunctions.net/getRealDiagnosisData';

      const response = await axios.post(
        functionUrl,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        diseaseStats: response.data.diseaseStats || [],
        totalConditions: response.data.totalConditions || 0,
        fetchedConditions: response.data.fetchedConditions || 0
      };
    } catch (error) {
      console.error('Error getting real diagnosis data via Firebase Function:', error);
      throw error;
    }
  }

  // Admin Portal - Patient Search (deprecated - use adminSearchPatients instead)
  async searchPatientsByPhone(phoneNumber: string): Promise<Patient[]> {
    try {
      // Use the existing searchPatients which works with OpenMRS
      // Search by phone as a query string
      const results = await this.searchPatients(phoneNumber);

      // Filter further if needed
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      return results.filter((patient: Patient) => {
        const phoneAttribute = patient.person.attributes?.find((attr) =>
          attr.attributeType.display.toLowerCase().includes('phone') ||
          attr.attributeType.display.toLowerCase().includes('telephone')
        );

        if (phoneAttribute) {
          const patientPhone = phoneAttribute.value.replace(/\D/g, '');
          return patientPhone.includes(cleanPhone);
        }

        // If no phone attribute, still include if name matches
        return true;
      });
    } catch (error) {
      console.error('Error searching patients by phone:', error);
      return []; // Return empty array instead of throwing
    }
  }

  // Helper method to get available identifier types
  async getPatientIdentifierTypes(): Promise<Array<{ uuid: string; display: string; required: boolean }>> {
    try {
      const response = await this.api.get('/ws/rest/v1/patientidentifiertype?v=full');
      return response.data.results.map((type: any) => ({
        uuid: type.uuid,
        display: type.name || type.display,
        required: type.required || false,
      }));
    } catch (error) {
      console.error('Error fetching identifier types:', error);
      throw error;
    }
  }

  // Helper method to get available person attribute types
  async getPersonAttributeTypes(): Promise<Array<{ uuid: string; display: string }>> {
    try {
      const response = await this.api.get('/ws/rest/v1/personattributetype?v=default');
      return response.data.results.map((type: any) => ({
        uuid: type.uuid,
        display: type.display,
      }));
    } catch (error) {
      console.error('Error fetching person attribute types:', error);
      throw error;
    }
  }

  // Diagnostic: Get full details of person attribute types
  async getFullPersonAttributeTypes(): Promise<any> {
    try {
      const response = await this.api.get('/ws/rest/v1/personattributetype?v=full');
      console.log('🔍 Full Person Attribute Types:', response.data.results);
      return response.data.results;
    } catch (error) {
      console.error('Error fetching full person attribute types:', error);
      throw error;
    }
  }

  // Diagnostic: Get address template configuration
  async getAddressTemplate(): Promise<any> {
    try {
      const response = await this.api.get('/ws/rest/v1/addresstemplate');
      console.log('🔍 Address Template:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching address template:', error);
      throw error;
    }
  }

  // Helper method to get available locations
  async getLocations(): Promise<Array<{ uuid: string; display: string }>> {
    try {
      const response = await this.api.get('/ws/rest/v1/location?v=default');
      return response.data.results.map((loc: any) => ({
        uuid: loc.uuid,
        display: loc.display,
      }));
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  }

  // Helper: Calculate Luhn check digit
  private calculateLuhnCheckDigit(identifier: string): string {
    // Remove any non-numeric characters
    const digits = identifier.replace(/\D/g, '');

    // Double every second digit from right to left
    let sum = 0;
    let isSecond = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isSecond) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isSecond = !isSecond;
    }

    // Calculate check digit
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit.toString();
  }

  // Admin Portal - Generate Patient Identifier
  async generateIdentifier(identifierTypeUuid: string): Promise<string> {
    try {
      // Step 1: Get full identifier type configuration
      console.log('🔍 Fetching identifier type configuration...');
      const typeResponse = await this.api.get(`/ws/rest/v1/patientidentifiertype/${identifierTypeUuid}?v=full`);
      const identifierType = typeResponse.data;

      console.log('📋 Identifier Type Details:', {
        name: identifierType.name,
        format: identifierType.format,
        validator: identifierType.validator,
        checkDigit: identifierType.checkDigit,
        required: identifierType.required
      });

      // Step 2: Try to get identifier sources for this type
      console.log('🔍 Fetching identifier sources...');
      try {
        const sourcesResponse = await this.api.get('/ws/rest/v1/idgen/identifiersource?v=full');
        const sources = sourcesResponse.data.results || [];

        console.log(`📋 Found ${sources.length} identifier sources:`, sources.map((s: any) => ({
          name: s.name,
          uuid: s.uuid,
          identifierType: s.identifierType?.display
        })));

        // Find source matching our identifier type
        const matchingSource = sources.find((source: any) =>
          source.identifierType?.uuid === identifierTypeUuid
        );

        if (matchingSource) {
          console.log('✅ Found matching identifier source:', matchingSource.name);

          // Try to generate using this source
          try {
            console.log(`🔄 Attempting to generate identifier from source ${matchingSource.uuid}...`);
            const genResponse = await this.api.post(
              `/ws/rest/v1/idgen/identifiersource/${matchingSource.uuid}/identifier`,
              {}
            );
            const generatedId = genResponse.data.identifier;
            console.log(`✅ Successfully generated identifier from OpenMRS: ${generatedId}`);
            return generatedId;
          } catch (genError: any) {
            console.warn('❌ Failed to generate from source:', genError.response?.data || genError.message);
          }
        } else {
          console.warn('⚠️ No matching identifier source found for this type');
        }
      } catch (sourcesError: any) {
        console.warn('⚠️ Could not fetch identifier sources:', sourcesError.response?.data || sourcesError.message);
      }

      // Step 3: Try the legacy ID generation module endpoint
      console.log('🔄 Trying legacy idgen module endpoint...');
      try {
        const legacyResponse = await this.api.get(
          `/module/idgen/generateIdentifier.form?source=${identifierTypeUuid}`
        );
        if (legacyResponse.data && legacyResponse.data.identifiers && legacyResponse.data.identifiers.length > 0) {
          const generatedId = legacyResponse.data.identifiers[0];
          console.log(`✅ Generated identifier from legacy endpoint: ${generatedId}`);
          return generatedId;
        }
      } catch (legacyError: any) {
        console.warn('⚠️ Legacy endpoint failed:', legacyError.response?.data || legacyError.message);
      }

      // Step 4: Fallback - Generate manually based on validator type
      console.warn('⚠️ All OpenMRS generation methods failed, using manual fallback');

      // Check what validator is configured
      if (identifierType.validator) {
        console.log(`📋 Validator configured: ${identifierType.validator}`);
      }

      // Generate with appropriate check digit algorithm
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      const baseIdentifier = `${timestamp}${random}`;

      // Use Luhn algorithm for check digit
      const checkDigit = this.calculateLuhnCheckDigit(baseIdentifier);
      const finalIdentifier = `${baseIdentifier}${checkDigit}`;

      console.log(`✅ Generated fallback identifier with Luhn: ${finalIdentifier}`);
      return finalIdentifier;
    } catch (error: any) {
      console.error('❌ All identifier generation methods failed:', error);
      throw new Error('Failed to generate patient identifier');
    }
  }

  // Admin Portal - Patient Registration
  async registerPatient(patientData: any): Promise<Patient> {
    try {
      // Step 1: Get or validate identifier type UUID
      let identifierTypeUuid = patientData.identifierType;

      // If no identifier type provided, fetch one
      if (!identifierTypeUuid) {
        try {
          const identifierTypesResponse = await this.api.get('/ws/rest/v1/patientidentifiertype?v=full');
          const identifierTypes = identifierTypesResponse.data.results;

          console.log('Available identifier types:', identifierTypes.map((t: any) => ({
            name: t.name,
            uuid: t.uuid,
            required: t.required
          })));

          // Find the first required identifier type, or fallback to first available
          const requiredType = identifierTypes.find((type: any) => type.required);
          const matchingType = requiredType || identifierTypes.find((type: any) =>
            type.name?.toLowerCase().includes('openmrs') ||
            type.name?.toLowerCase().includes('patient')
          );
          identifierTypeUuid = matchingType ? matchingType.uuid : identifierTypes[0]?.uuid;

          console.log('Using identifier type:', matchingType?.name || identifierTypes[0]?.name, identifierTypeUuid);
        } catch (err: any) {
          console.error('Failed to fetch identifier types:', err);
          console.error('Error details:', err.response?.data);
          throw new Error('Failed to fetch patient identifier types. Please check OpenMRS configuration.');
        }
      } else {
        console.log('Using provided identifier type UUID:', identifierTypeUuid);
      }

      // Step 2: Get location UUID (use default location or first available)
      let locationUuid = '8d6c993e-c2cc-11de-8d13-0010c6dffd0f'; // Default fallback
      try {
        const locationsResponse = await this.api.get('/ws/rest/v1/location?v=default&limit=1');
        if (locationsResponse.data.results && locationsResponse.data.results.length > 0) {
          locationUuid = locationsResponse.data.results[0].uuid;
          console.log('Using location:', locationsResponse.data.results[0].display, locationUuid);
        }
      } catch (err) {
        console.warn('Failed to fetch locations, using default:', err);
      }

      // Step 3: Fetch person attribute type UUIDs dynamically
      let attributeUuids: any = {};

      // UUID validation regex - must be valid hex characters
      const isValidUuid = (uuid: string | undefined): boolean => {
        if (!uuid) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
      };

      try {
        const attributeTypesResponse = await this.api.get('/ws/rest/v1/personattributetype?v=default');
        const attributeTypes = attributeTypesResponse.data.results;

        // Map attribute types by name with UUID validation
        const findAttrUuid = (searchTerms: string[]) => {
          const attr = attributeTypes.find((type: any) =>
            searchTerms.some(term => type.display.toLowerCase().includes(term.toLowerCase()))
          );
          const uuid = attr?.uuid;

          // Only return if UUID is valid
          if (uuid && isValidUuid(uuid)) {
            return uuid;
          } else if (uuid) {
            console.warn(`⚠️ Invalid UUID found for ${attr.display}: ${uuid} - Skipping this attribute`);
          }
          return undefined;
        };

        attributeUuids = {
          telephoneNumber: findAttrUuid(['telephone', 'phone', 'personal contact']),
          email: findAttrUuid(['email']),
          community: findAttrUuid(['community']),
          religion: findAttrUuid(['religion']),
          occupation: findAttrUuid(['occupation']),
          maritalStatus: findAttrUuid(['marital']),
          educationLevel: findAttrUuid(['education']),
          emergencyContactName: findAttrUuid(['emergency contact name']),
          emergencyContactPhone: findAttrUuid(['emergency contact phone', 'emergency number']),
          emergencyContactRelationship: findAttrUuid(['emergency contact relationship']),
        };

        console.log('✅ Resolved valid person attribute UUIDs:', attributeUuids);

        // Log which attributes were skipped
        const skippedAttrs = Object.entries(attributeUuids)
          .filter(([_, uuid]) => !uuid)
          .map(([key, _]) => key);
        if (skippedAttrs.length > 0) {
          console.warn(`⚠️ Skipped invalid/missing attributes: ${skippedAttrs.join(', ')}`);
        }
      } catch (err) {
        console.error('Failed to fetch person attribute types:', err);
      }

      console.log('Using person attribute UUIDs from configuration');

      // Step 4: Build payload with UUIDs
      const payload: any = {
        person: {
          names: [
            {
              givenName: patientData.givenName,
              middleName: patientData.middleName || undefined,
              familyName: patientData.familyName,
            },
          ],
          gender: patientData.gender,
          birthdate: patientData.birthdate,
          addresses: [
            {
              country: 'Ghana',
            },
          ],
          attributes: [],
        },
        identifiers: [
          {
            identifier: patientData.identifier,
            identifierType: identifierTypeUuid,
            location: locationUuid,
          },
        ],
      };

      // Add person attributes (using correct UUIDs from OpenMRS configuration)
      const attributesToAdd = [
        { uuid: attributeUuids.telephoneNumber, value: patientData.phoneNumber, label: 'Personal Contact' },
        { uuid: attributeUuids.email, value: patientData.email, label: 'Email' },
        { uuid: attributeUuids.community, value: patientData.community, label: 'Community' },
        { uuid: attributeUuids.religion, value: patientData.religion, label: 'Religion' },
        { uuid: attributeUuids.occupation, value: patientData.occupation, label: 'Occupation' },
        { uuid: attributeUuids.maritalStatus, value: patientData.maritalStatus, label: 'Marital Status' },
        { uuid: attributeUuids.educationLevel, value: patientData.educationLevel, label: 'Education Level' },
        { uuid: attributeUuids.emergencyContactName, value: patientData.emergencyContactName, label: 'Emergency Contact Name' },
        { uuid: attributeUuids.emergencyContactPhone, value: patientData.emergencyContactPhone, label: 'Emergency Contact Phone' },
        { uuid: attributeUuids.emergencyContactRelationship, value: patientData.emergencyContactRelationship, label: 'Emergency Contact Relationship' },
      ];

      attributesToAdd.forEach(attr => {
        // Only add if UUID exists and value is provided
        if (attr.uuid && attr.value && attr.value.trim()) {
          payload.person.attributes.push({
            attributeType: attr.uuid,
            value: attr.value.trim(), // Trim whitespace
          });
          console.log(`Adding ${attr.label}:`, attr.value);
        } else if (!attr.uuid && attr.value) {
          console.warn(`Skipping ${attr.label} - UUID not found`);
        }
      });

      console.log('Registering patient with payload:', JSON.stringify(payload, null, 2));

      const response = await this.api.post('/ws/rest/v1/patient', payload);
      return response.data;
    } catch (error: any) {
      console.error('Error registering patient:', error);
      console.error('Error response:', error.response?.data);

      // Log detailed error information
      if (error.response?.data?.error) {
        const errorData = error.response.data.error;
        console.error('Error details:', {
          message: errorData.message,
          code: errorData.code,
          globalErrors: errorData.globalErrors,
          fieldErrors: errorData.fieldErrors
        });
      }

      throw error;
    }
  }

  // Admin Portal - Create Visit
  async createVisit(patientUuid: string, visitTypeUuid: string, locationUuid: string, startDatetime?: Date): Promise<Visit> {
    try {
      const payload = {
        patient: patientUuid,
        visitType: visitTypeUuid,
        location: locationUuid,
        startDatetime: startDatetime ? startDatetime.toISOString() : new Date().toISOString(),
      };

      console.log('Creating visit with payload:', payload);
      const response = await this.api.post('/ws/rest/v1/visit', payload);
      return response.data;
    } catch (error: any) {
      console.error('Error creating visit:', error);
      console.error('Error response:', error.response?.data);
      throw error;
    }
  }

  // Admin Portal - Create Encounter
  async createEncounter(
    patientUuid: string,
    encounterTypeUuid: string,
    locationUuid: string,
    formUuid: string,
    visitUuid?: string,
    encounterDatetime?: Date
  ): Promise<Encounter> {
    try {
      const payload: any = {
        patient: patientUuid,
        encounterType: encounterTypeUuid,
        location: locationUuid,
        form: formUuid,
        encounterDatetime: encounterDatetime ? encounterDatetime.toISOString() : new Date().toISOString(),
        obs: [], // Observations will be added separately
      };

      if (visitUuid) {
        payload.visit = visitUuid;
      }

      console.log('Creating encounter with payload:', payload);
      const response = await this.api.post('/ws/rest/v1/encounter', payload);
      return response.data;
    } catch (error: any) {
      console.error('Error creating encounter:', error);
      console.error('Error response:', error.response?.data);
      throw error;
    }
  }

  // Admin Portal - Create Observation
  async createObservation(
    encounterUuid: string,
    patientUuid: string,
    conceptUuid: string,
    value: number | string,
    obsDatetime?: Date
  ): Promise<Observation> {
    try {
      const payload = {
        encounter: encounterUuid,
        person: patientUuid,
        concept: conceptUuid,
        value: value,
        obsDatetime: obsDatetime ? obsDatetime.toISOString() : new Date().toISOString(),
      };

      console.log('Creating observation:', { concept: conceptUuid, value });
      const response = await this.api.post('/ws/rest/v1/obs', payload);
      return response.data;
    } catch (error: any) {
      console.error('Error creating observation:', error);
      console.error('Error response:', error.response?.data);
      throw error;
    }
  }

  // Admin Portal - Add Diagnosis to Encounter
  async addDiagnosis(
    encounterUuid: string,
    patientUuid: string,
    diagnosisConceptUuid: string,
    certainty: 'PRESUMED' | 'CONFIRMED' = 'CONFIRMED'
  ): Promise<any> {
    try {
      // In OpenMRS, diagnoses are stored as observations with specific diagnosis concepts
      // We need to find the diagnosis concept set first
      const DIAGNOSIS_CONCEPT_SET = '159947AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // Diagnosis concept set UUID
      const DIAGNOSIS_CERTAINTY = '159394AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // Diagnosis certainty
      const DIAGNOSIS_ORDER = '159946AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // Diagnosis order (PRIMARY/SECONDARY)

      const obsDatetime = new Date().toISOString();

      // Create diagnosis observation group
      const payload = {
        encounter: encounterUuid,
        person: patientUuid,
        concept: DIAGNOSIS_CONCEPT_SET,
        groupMembers: [
          {
            person: patientUuid,
            concept: '1284AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // Diagnosis coded
            value: diagnosisConceptUuid,
            obsDatetime: obsDatetime,
          },
          {
            person: patientUuid,
            concept: DIAGNOSIS_CERTAINTY,
            value: certainty === 'CONFIRMED' ?
              '159392AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' : // Confirmed
              '159393AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',   // Presumed
            obsDatetime: obsDatetime,
          },
          {
            person: patientUuid,
            concept: DIAGNOSIS_ORDER,
            value: '159943AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // Primary
            obsDatetime: obsDatetime,
          },
        ],
        obsDatetime: obsDatetime,
      };

      console.log('Adding diagnosis:', { diagnosis: diagnosisConceptUuid, certainty });
      const response = await this.api.post('/ws/rest/v1/obs', payload);
      return response.data;
    } catch (error: any) {
      console.error('Error adding diagnosis:', error);
      console.error('Error response:', error.response?.data);
      throw error;
    }
  }

  // Admin Portal - Search Diagnoses from Concept Dictionary
  async searchDiagnoses(searchTerm: string): Promise<Array<{ uuid: string; display: string }>> {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        return [];
      }

      // Search for concepts in the "Diagnosis" class
      const response = await this.api.get('/ws/rest/v1/concept', {
        params: {
          q: searchTerm,
          class: 'Diagnosis', // Filter by Diagnosis concept class
          v: 'custom:(uuid,display)',
          limit: 20,
        },
      });

      return response.data.results || [];
    } catch (error: any) {
      console.error('Error searching diagnoses:', error);
      // Return empty array instead of throwing to allow form to continue working
      return [];
    }
  }

  // Admin Portal - Delete Patient (with all related data)
  async deletePatient(patientUuid: string): Promise<void> {
    try {
      // OpenMRS will cascade delete related data (visits, encounters, observations)
      await this.api.delete(`/ws/rest/v1/patient/${patientUuid}`, {
        params: { purge: true } // Permanently delete (not just void)
      });
      console.log('✅ Patient deleted:', patientUuid);
    } catch (error: any) {
      console.error('Error deleting patient:', error);
      throw error;
    }
  }

  // Admin Portal - Get All Patients for Deletion (bulk operations)
  async getAllPatientsForDeletion(): Promise<Array<{ uuid: string; display: string }>> {
    try {
      // Use FHIR API instead of REST API (more reliable)
      const response = await this.api.get('/ws/fhir2/R4/Patient', {
        params: {
          _count: 1000, // FHIR uses _count instead of limit
        },
      });

      // Map FHIR resources to simple format
      const patients = (response.data.entry || []).map((entry: any) => {
        const patient = entry.resource;
        const name = patient.name?.[0];
        const givenName = name?.given?.join(' ') || '';
        const familyName = name?.family || '';
        const display = `${givenName} ${familyName}`.trim() || 'Unknown';

        return {
          uuid: patient.id,
          display: display
        };
      });

      return patients;
    } catch (error: any) {
      console.error('Error fetching all patients:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();
export default apiService;
