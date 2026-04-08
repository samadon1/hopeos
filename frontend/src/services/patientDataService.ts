import axios from 'axios';

const FIREBASE_FUNCTIONS_URL = 'https://us-central1-okb-ehr.cloudfunctions.net';

export interface PatientData {
  uuid: string;
  display: string;
  person: {
    display: string;
    preferredName: {
      givenName: string;
      familyName: string;
    };
    age: number;
    gender: string;
    birthdate: string;
    attributes: Array<{
      display: string;
      value: string;
      attributeType: {
        display: string;
      };
    }>;
  };
  identifiers: Array<{
    identifier: string;
    identifierType: {
      display: string;
    };
  }>;
}

export interface Observation {
  uuid: string;
  display: string;
  concept: {
    display: string;
    uuid: string;
  };
  value: any;
  obsDatetime: string;
  encounter: {
    display: string;
    uuid: string;
  };
}

export interface Encounter {
  uuid: string;
  display: string;
  encounterDatetime: string;
  encounterType: {
    display: string;
    uuid: string;
  };
  provider: {
    display: string;
    uuid: string;
  };
  location: {
    display: string;
    uuid: string;
  };
  obs: Observation[];
}

export interface MedicationOrder {
  uuid: string;
  display: string;
  type: string;
  status?: string;
  dateActivated: string;
  drug?: {
    display: string;
    uuid: string;
  };
  dose?: number;
  doseUnits?: {
    display: string;
  };
  frequency?: {
    display: string;
  };
  route?: {
    display: string;
  };
  dateStopped?: string;
  instructions?: string;
}

export interface LabTest {
  uuid: string;
  display: string;
  type: string;
  status?: string;
  dateActivated: string;
  concept?: {
    display: string;
    uuid: string;
  };
}

export interface ClinicalNote {
  uuid: string;
  display: string;
  concept: {
    display: string;
    uuid: string;
  };
  value: string;
  obsDatetime: string;
  encounter: {
    display: string;
    uuid: string;
  };
}

export interface LabResult {
  uuid: string;
  display: string;
  concept: {
    display: string;
    uuid: string;
  };
  value: any;
  obsDatetime: string;
  encounter: {
    display: string;
    uuid: string;
  };
  status: string;
}

export interface Allergy {
  uuid: string;
  display: string;
  allergen: {
    display: string;
    uuid: string;
  };
  severity: {
    display: string;
  };
  reactions: Array<{
    display: string;
  }>;
}

export interface Condition {
  uuid: string;
  display: string;
  condition: {
    display: string;
    uuid: string;
  };
  clinicalStatus: string;
  onsetDate: string;
  endDate?: string;
}

export interface Immunization {
  uuid: string;
  display: string;
  vaccine: {
    display: string;
    uuid: string;
  };
  dateGiven: string;
  lotNumber?: string;
  manufacturer?: string;
  expirationDate?: string;
}

export interface Appointment {
  uuid: string;
  appointmentNumber: string;
  dateCreated: number;
  dateAppointmentScheduled: number;
  patient: {
    OpenMRSID: string;
    identifier: string;
    gender: string;
    name: string;
    uuid: string;
    age: number;
    customAttributes: any;
  };
  service: {
    appointmentServiceId: number;
    name: string;
    description: string | null;
    speciality: {
      name: string;
      uuid: string;
    };
    startTime: string;
    endTime: string;
    maxAppointmentsLimit: number | null;
    durationMins: number | null;
    location: any;
    uuid: string;
    color: string;
    initialAppointmentStatus: string | null;
    creatorName: string | null;
  };
  serviceType: any;
  provider: any;
  location: {
    name: string;
    uuid: string;
  };
  startDateTime: number;
  endDateTime: number;
  appointmentKind: string;
  status: string;
  comments: string;
  additionalInfo: any;
  teleconsultation: any;
  providers: Array<{
    uuid: string;
    comments: string | null;
    response: string;
    name: string;
  }>;
  voided: boolean;
  extensions: {
    patientEmailDefined: boolean;
  };
  teleconsultationLink: string | null;
  priority: any;
  recurring: boolean;
}

export interface Visit {
  uuid: string;
  display: string;
  startDatetime: string;
  stopDatetime?: string;
  visitType: {
    display: string;
    uuid: string;
  };
  location: {
    display: string;
    uuid: string;
  };
  encounters: Encounter[];
}

export interface CompletePatientData {
  patient: PatientData;
  observations: Observation[];
  encounters: Encounter[];
  visits: Visit[];
  medications: MedicationOrder[];
  labTests: LabTest[];
  labResults: LabResult[];
  clinicalNotes: ClinicalNote[];
  allergies: Allergy[];
  conditions: Condition[];
  immunizations: Immunization[];
  appointments: Appointment[];
  vitals: Observation[];
}

class PatientDataService {
  // Get complete patient data
  async getCompletePatientData(patientUuid: string): Promise<CompletePatientData> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/getCompletePatientData`,
        { patientUuid },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Get complete patient data error:', error);
      throw new Error(error.response?.data?.error || 'Failed to get patient data');
    }
  }

  // Get patient basic info
  async getPatientInfo(patientUuid: string): Promise<PatientData> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/getPatientInfo`,
        { patientUuid },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Get patient info error:', error);
      throw new Error(error.response?.data?.error || 'Failed to get patient info');
    }
  }

  // Get patient observations (vitals, lab results, etc.)
  async getPatientObservations(patientUuid: string): Promise<Observation[]> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/getPatientObservations`,
        { patientUuid },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Get patient observations error:', error);
      throw new Error(error.response?.data?.error || 'Failed to get observations');
    }
  }

  // Get patient encounters
  async getPatientEncounters(patientUuid: string): Promise<Encounter[]> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/getPatientEncounters`,
        { patientUuid },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Get patient encounters error:', error);
      throw new Error(error.response?.data?.error || 'Failed to get encounters');
    }
  }

  // Get patient medications
  async getPatientMedications(patientUuid: string): Promise<MedicationOrder[]> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/getPatientMedications`,
        { patientUuid },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Get patient medications error:', error);
      throw new Error(error.response?.data?.error || 'Failed to get medications');
    }
  }

  // Get patient lab results
  async getPatientLabResults(patientUuid: string): Promise<LabResult[]> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/getPatientLabResults`,
        { patientUuid },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Get patient lab results error:', error);
      throw new Error(error.response?.data?.error || 'Failed to get lab results');
    }
  }

  // Get patient allergies
  async getPatientAllergies(patientUuid: string): Promise<Allergy[]> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/getPatientAllergies`,
        { patientUuid },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Get patient allergies error:', error);
      throw new Error(error.response?.data?.error || 'Failed to get allergies');
    }
  }

  // Get patient conditions
  async getPatientConditions(patientUuid: string): Promise<Condition[]> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/getPatientConditions`,
        { patientUuid },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Get patient conditions error:', error);
      throw new Error(error.response?.data?.error || 'Failed to get conditions');
    }
  }

  // Get patient immunizations
  async getPatientImmunizations(patientUuid: string): Promise<Immunization[]> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/getPatientImmunizations`,
        { patientUuid },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Get patient immunizations error:', error);
      throw new Error(error.response?.data?.error || 'Failed to get immunizations');
    }
  }

  // Get patient visits
  async getPatientVisits(patientUuid: string): Promise<Visit[]> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/getPatientVisits`,
        { patientUuid },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Get patient visits error:', error);
      throw new Error(error.response?.data?.error || 'Failed to get visits');
    }
  }

  // Get patient appointments
  async getPatientAppointments(patientUuid: string): Promise<Appointment[]> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/getPatientAppointments`,
        { patientUuid },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Get patient appointments error:', error);
      throw new Error(error.response?.data?.error || 'Failed to get appointments');
    }
  }
}

export const patientDataService = new PatientDataService();
export default patientDataService;
