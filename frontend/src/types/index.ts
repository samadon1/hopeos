// OpenMRS API Types
export interface Patient {
  uuid: string;
  display: string;
  identifiers: Array<{
    uuid: string;
    identifier: string;
    identifierType: {
      uuid: string;
      display: string;
    };
  }>;
  person: {
    uuid: string;
    display: string;
    gender: string;
    age: number;
    birthdate: string;
    birthdateEstimated: boolean;
    dead: boolean;
    deathDate?: string;
    preferredName: {
      uuid: string;
      display: string;
      givenName: string;
      middleName?: string;
      familyName: string;
    };
    preferredAddress: {
      uuid: string;
      display: string;
      address1?: string;
      address2?: string;
      cityVillage?: string;
      stateProvince?: string;
      country?: string;
      postalCode?: string;
    };
    attributes: Array<{
      uuid: string;
      display: string;
      value: string;
      attributeType: {
        uuid: string;
        display: string;
      };
    }>;
  };
}

export interface Encounter {
  uuid: string;
  display: string;
  encounterDatetime: string;
  patient: {
    uuid: string;
    display: string;
  };
  location: {
    uuid: string;
    display: string;
  };
  encounterType: {
    uuid: string;
    display: string;
  };
  encounterProviders: Array<{
    uuid: string;
    provider: {
      uuid: string;
      display: string;
    };
    encounterRole: {
      uuid: string;
      display: string;
    };
  }>;
  obs: Array<Observation>;
}

export interface Observation {
  uuid: string;
  display: string;
  concept: {
    uuid: string;
    display: string;
  };
  person: {
    uuid: string;
    display: string;
  };
  obsDatetime: string;
  value: string | number | boolean;
  groupMembers?: Array<Observation>;
}

export interface Visit {
  uuid: string;
  display: string;
  startDatetime: string;
  stopDatetime?: string;
  visitType: {
    uuid: string;
    display: string;
  };
  location: {
    uuid: string;
    display: string;
  };
  encounters: Array<Encounter>;
}

// FHIR Types (simplified)
export interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  identifier: Array<{
    value: string;
    type: {
      coding: Array<{
        code: string;
        display: string;
      }>;
    };
  }>;
  name: Array<{
    given: string[];
    family: string;
  }>;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string;
  address?: Array<{
    line: string[];
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
}

export interface FHIRObservation {
  resourceType: 'Observation';
  id: string;
  status: string;
  code: {
    coding: Array<{
      code: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
  };
  effectiveDateTime: string;
  valueQuantity?: {
    value: number;
    unit: string;
  };
  valueString?: string;
  valueCodableConcept?: {
    coding: Array<{
      code: string;
      display: string;
    }>;
  };
}

export interface FHIRMedicationRequest {
  resourceType: 'MedicationRequest';
  id: string;
  status: string;
  medicationCodeableConcept: {
    coding: Array<{
      code: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
  };
  authoredOn: string;
  dosageInstruction: Array<{
    text: string;
  }>;
}

// App-specific types
export interface User {
  uuid: string;
  username: string;
  person: {
    uuid: string;
    display: string;
  };
  roles: Array<{
    uuid: string;
    display: string;
  }>;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  patient: Patient | null;
  loading: boolean;
  error: string | null;
}

export interface ApiResponse<T> {
  results: T[];
  totalCount?: number;
}

// Firebase types (for future integration)
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface NotificationPreferences {
  appointmentReminders: boolean;
  labResultsReady: boolean;
  medicationReminders: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

export interface PatientProfile {
  preferences: NotificationPreferences;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  }>;
  lastLoginDate: string;
  deviceTokens: string[]; // For push notifications
}
