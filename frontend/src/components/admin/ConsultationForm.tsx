"use client"

import { useState, useEffect, useRef } from 'react';
import { X, Stethoscope, AlertCircle, CheckCircle2, Loader2, Search } from 'lucide-react';
import apiService from '../../services/api.service';

interface ConsultationFormProps {
  patientUuid: string;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
  // Optional: existing encounter data for view/edit mode
  existingEncounter?: any;
  viewMode?: boolean;
}

// Concept UUIDs from Form 12 JSON Schema
const CONCEPTS = {
  // Page 1: Complaints & History
  PRESENTING_COMPLAINT: '5219AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  HISTORY_COMPLAINT: '1390AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  PREGNANCY_STATUS: '5272AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',

  // Page 2: On Direct Questioning - Constitutional
  WEIGHT_LOSS: '832AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ANOREXIA: '126AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  WEIGHT_GAIN: '460AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  FEVER: '1498AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  CHILLS: '143264AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  JAUNDICE: '143AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  LACK_ENERGY: '119537AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',

  // Musculoskeletal
  JOINT_STIFFNESS: '125570AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  MUSCLE_WEAKNESS: '133632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  KNEE_PAIN: '116558AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  NECK_PAIN: '133632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  MUSCLE_PAIN: '133632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  MUSCLE_STIFFNESS: '125570AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',

  // Gastrointestinal
  ABDOMINAL_PAIN: '151AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  CONSTIPATION: '142AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DENTAL_PROBLEMS: '118983AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DIARRHEA: '142AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DYSPHAGIA: '118789AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ODYNOPHAGIA: '135764AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',

  ADDITIONAL_QUESTIONING: '160632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',

  // Page 3: Medical History
  PAST_MEDICAL_HISTORY: '1633AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  OBS_GYN_HISTORY: '160080AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DEVELOPMENT_HISTORY: '162747AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  SURGICAL_HISTORY: '1834AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DRUG_HISTORY: '160593AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  FAMILY_HISTORY: '160593AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  SOCIAL_HISTORY: '1655AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',

  // Page 4: Physical Examination
  GENERAL_OBSERVATIONS: '162737AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  BLOOD_PRESSURE: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  PULSE: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  CARDIO_NOTES: '159395AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  RESPIRATORY_NOTES: '159395AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ABDOMINAL_EXAM: '160947AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  CNS_EXAM: '163043AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ENT_EXAM: '163042AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  GENITOURINARY_EXAM: '163045AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  MUSCULOSKELETAL_EXAM: '163044AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  EYE_EXAM: '163041AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  STATUS_LOCALIS: '159395AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  SKIN_EXAM: '1119AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',

  // Page 5: Diagnosis
  DIAGNOSIS_TYPE: '159946AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  DIAGNOSIS_SEARCH: '1284AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  WORKING_DIAGNOSIS: '1284AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',

  // Answer concepts
  YES: '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  NO: '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  PROVISIONAL_DIAGNOSIS: '159944AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  FINAL_DIAGNOSIS: '159943AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  QUERY_DIAGNOSIS: '159947AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

// Common diagnoses with concept UUIDs
const COMMON_DIAGNOSES = [
  { name: 'Malaria', uuid: '1643AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  { name: 'Hypertension', uuid: '117399AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  { name: 'Diabetes Mellitus', uuid: '119481AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  { name: 'Typhoid Fever', uuid: '141AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  { name: 'Upper Respiratory Tract Infection', uuid: '6097AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  { name: 'Gastroenteritis', uuid: '142412AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  { name: 'Pneumonia', uuid: '114100AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  { name: 'Tuberculosis', uuid: '112141AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  { name: 'Anemia', uuid: '121629AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  { name: 'Asthma', uuid: '121375AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
];

const CONSULTATION_ENCOUNTER_TYPE = 'd7151f82-c1f3-4152-a605-2f9ea7414a79';
const CONSULTATION_FORM_UUID = '14ce689a-1b63-4d5c-b854-f373d0ce9a7e';
const LOCATION_UUID = '44c3efb0-2583-4c80-a79e-1f756a03c0a1';
const VISIT_TYPE_UUID = '7b0f5697-27e3-40c4-8bae-f4049abfb4ed';

type YesNoValue = 'yes' | 'no' | '';

export default function ConsultationForm({ patientUuid, patientName, onClose, onSuccess, existingEncounter, viewMode: initialViewMode = false }: ConsultationFormProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const viewMode = initialViewMode && !isEditing;

  // Patient demographics for conditional field visibility
  const [patientGender, setPatientGender] = useState<string | null>(null);
  const [patientAge, setPatientAge] = useState<number | null>(null);

  // Extract existing data if viewing an encounter
  const existingData = existingEncounter?.structuredData;

  // Page 1: Complaints & History
  const [presentingComplaint, setPresentingComplaint] = useState(existingData?.complaintsHistory?.presentingComplaint || '');
  const [historyComplaint, setHistoryComplaint] = useState(existingData?.complaintsHistory?.historyOfComplaint || '');
  const [pregnancyStatus, setPregnancyStatus] = useState<YesNoValue>(existingData?.complaintsHistory?.pregnancyStatus || '');

  // Page 2: On Direct Questioning - Constitutional
  const [weightLoss, setWeightLoss] = useState<YesNoValue>(existingData?.reviewOfSystems?.constitutional?.weightLoss || '');
  const [anorexia, setAnorexia] = useState<YesNoValue>(existingData?.reviewOfSystems?.constitutional?.anorexia || '');
  const [weightGain, setWeightGain] = useState<YesNoValue>(existingData?.reviewOfSystems?.constitutional?.weightGain || '');
  const [fever, setFever] = useState<YesNoValue>(existingData?.reviewOfSystems?.constitutional?.fever || '');
  const [chills, setChills] = useState<YesNoValue>(existingData?.reviewOfSystems?.constitutional?.chills || '');
  const [jaundice, setJaundice] = useState<YesNoValue>(existingData?.reviewOfSystems?.constitutional?.jaundice || '');
  const [lackEnergy, setLackEnergy] = useState<YesNoValue>(existingData?.reviewOfSystems?.constitutional?.lackOfEnergy || '');

  // Musculoskeletal
  const [jointStiffness, setJointStiffness] = useState<YesNoValue>(existingData?.reviewOfSystems?.musculoskeletal?.jointStiffness || '');
  const [muscleWeakness, setMuscleWeakness] = useState<YesNoValue>(existingData?.reviewOfSystems?.musculoskeletal?.muscleWeakness || '');
  const [kneePain, setKneePain] = useState<YesNoValue>(existingData?.reviewOfSystems?.musculoskeletal?.kneePain || '');
  const [neckPain, setNeckPain] = useState<YesNoValue>(existingData?.reviewOfSystems?.musculoskeletal?.neckPain || '');
  const [musclePain, setMusclePain] = useState<YesNoValue>(existingData?.reviewOfSystems?.musculoskeletal?.musclePain || '');
  const [muscleStiffness, setMuscleStiffness] = useState<YesNoValue>(existingData?.reviewOfSystems?.musculoskeletal?.muscleStiffness || '');

  // Gastrointestinal
  const [abdominalPain, setAbdominalPain] = useState<YesNoValue>(existingData?.reviewOfSystems?.gastrointestinal?.abdominalPain || '');
  const [constipation, setConstipation] = useState<YesNoValue>(existingData?.reviewOfSystems?.gastrointestinal?.constipation || '');
  const [dentalProblems, setDentalProblems] = useState<YesNoValue>(existingData?.reviewOfSystems?.gastrointestinal?.dentalProblems || '');
  const [diarrhea, setDiarrhea] = useState<YesNoValue>(existingData?.reviewOfSystems?.gastrointestinal?.diarrhea || '');
  const [dysphagia, setDysphagia] = useState<YesNoValue>(existingData?.reviewOfSystems?.gastrointestinal?.difficultySwallowing || '');
  const [odynophagia, setOdynophagia] = useState<YesNoValue>(existingData?.reviewOfSystems?.gastrointestinal?.painfulSwallowing || '');

  const [additionalQuestioning, setAdditionalQuestioning] = useState(existingData?.reviewOfSystems?.additionalNotes || '');

  // Page 3: Medical History
  const [pastMedicalHistory, setPastMedicalHistory] = useState(existingData?.medicalHistory?.pastMedicalHistory || '');
  const [obsGynHistory, setObsGynHistory] = useState(existingData?.medicalHistory?.obsGynHistory || '');
  const [developmentHistory, setDevelopmentHistory] = useState(existingData?.medicalHistory?.developmentHistory || '');
  const [surgicalHistory, setSurgicalHistory] = useState(existingData?.medicalHistory?.surgicalHistory || '');
  const [drugHistory, setDrugHistory] = useState(existingData?.medicalHistory?.drugHistory || '');
  const [familyHistory, setFamilyHistory] = useState(existingData?.medicalHistory?.familyHistory || '');
  const [socialHistory, setSocialHistory] = useState(existingData?.medicalHistory?.socialHistory || '');

  // Page 4: Physical Examination
  const [generalObservations, setGeneralObservations] = useState(existingData?.physicalExamination?.generalObservations || '');
  const [bloodPressure, setBloodPressure] = useState(existingData?.physicalExamination?.vitals?.bloodPressure || '');
  const [pulse, setPulse] = useState(existingData?.physicalExamination?.vitals?.pulse || '');
  const [cardioNotes, setCardioNotes] = useState(existingData?.physicalExamination?.cardiovascular || '');
  const [respiratoryNotes, setRespiratoryNotes] = useState(existingData?.physicalExamination?.respiratory || '');
  const [abdominalExam, setAbdominalExam] = useState(existingData?.physicalExamination?.abdominal || '');
  const [cnsExam, setCnsExam] = useState(existingData?.physicalExamination?.cns || '');
  const [entExam, setEntExam] = useState(existingData?.physicalExamination?.ent || '');
  const [genitourinaryExam, setGenitourinaryExam] = useState(existingData?.physicalExamination?.genitourinary || '');
  const [musculoskeletalExam, setMusculoskeletalExam] = useState(existingData?.physicalExamination?.musculoskeletal || '');
  const [eyeExam, setEyeExam] = useState(existingData?.physicalExamination?.eye || '');
  const [statusLocalis, setStatusLocalis] = useState(existingData?.physicalExamination?.statusLocalis || '');
  const [skinExam, setSkinExam] = useState(existingData?.physicalExamination?.skin || '');

  // Page 5: Diagnosis
  const [diagnosisType, setDiagnosisType] = useState<'provisional' | 'final' | 'query'>(existingData?.diagnosisInfo?.type || 'provisional');
  const [workingDiagnosis, setWorkingDiagnosis] = useState(existingData?.diagnosisInfo?.diagnosis || '');
  const [diagnosisConceptUuid, setDiagnosisConceptUuid] = useState(existingData?.diagnosisInfo?.conceptUuid || '');
  const [diagnosisSearchTerm, setDiagnosisSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ uuid: string; display: string }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [useCustomDiagnosis, setUseCustomDiagnosis] = useState(existingData?.diagnosisInfo?.isCustom || false);
  const [customDiagnosisText, setCustomDiagnosisText] = useState(existingData?.diagnosisInfo?.isCustom ? existingData?.diagnosisInfo?.diagnosis : '');
  const searchRef = useRef<HTMLDivElement>(null);

  const tabs = [
    'Complaints & History',
    'Review of Systems',
    'Medical History',
    'Physical Exam',
    'Diagnosis',
  ];

  // Debounced search for diagnoses
  useEffect(() => {
    const searchDiagnoses = async () => {
      if (diagnosisSearchTerm.length >= 2) {
        setIsSearching(true);
        const results = await apiService.searchDiagnoses(diagnosisSearchTerm);
        setSearchResults(results);
        setShowSearchResults(true);
        setIsSearching(false);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    };

    const timeoutId = setTimeout(searchDiagnoses, 300); // Debounce 300ms
    return () => clearTimeout(timeoutId);
  }, [diagnosisSearchTerm]);

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch patient data for conditional field visibility (pregnancy status)
  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const patientData: any = await apiService.getPatient(patientUuid);
        if (patientData) {
          // Set gender
          setPatientGender(patientData.gender?.toLowerCase() || null);

          // Calculate age from DOB or use stored age
          if (patientData.dateOfBirth) {
            const dob = patientData.dateOfBirth?.toDate ? patientData.dateOfBirth.toDate() : new Date(patientData.dateOfBirth);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const monthDiff = today.getMonth() - dob.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
              age--;
            }
            setPatientAge(age);
          } else if (patientData.age) {
            setPatientAge(parseInt(patientData.age));
          }
        }
      } catch (error) {
        console.warn('Could not fetch patient data for pregnancy status visibility:', error);
      }
    };

    fetchPatientData();
  }, [patientUuid]);

  // Determine if pregnancy status field should be shown
  // Only show for females aged 15-49 (WHO reproductive age)
  const showPregnancyStatus = patientGender === 'female' && patientAge !== null && patientAge >= 15 && patientAge <= 49;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate diagnosis is provided (either coded or custom text)
    if (!useCustomDiagnosis && (!diagnosisConceptUuid || !workingDiagnosis)) {
      setError('Please select a diagnosis from the dropdown or search');
      return;
    }

    if (useCustomDiagnosis && !customDiagnosisText.trim()) {
      setError('Please enter a custom diagnosis');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Get patient's document ID
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
          console.warn('Could not find patient, using UUID as document ID');
        }
      }

      // Step 2: Get or create visit
      const now = new Date();
      let firestoreVisit = await apiService.getPatientVisits(patientDocId).then(visits => {
        // Find active visit for today or create new one
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return visits.find(v => {
          const visitDate = v.startDatetime?.toDate ? v.startDatetime.toDate() : new Date(v.startDatetime);
          visitDate.setHours(0, 0, 0, 0);
          return visitDate.getTime() === today.getTime() && !v.stopDatetime;
        });
      });

      if (!firestoreVisit) {
        firestoreVisit = await apiService.createVisit({
          patientId: patientDocId,
          patientName: patientName,
          visitType: 'Outpatient',
          location: 'OKB Clinic',
          startDatetime: now.toISOString(),
        });
      }

      // Step 3: Prepare encounter data for OpenMRS (optional, for backward compatibility)
      // Note: OpenMRS API calls are optional for backward compatibility
      let openmrsVisit = null;
      let encounterData = null;
      
      try {
        // Try to get/create visit in OpenMRS (optional)
        openmrsVisit = await apiService.getActiveVisit(patientUuid).catch(() => null);
        if (!openmrsVisit) {
          openmrsVisit = await apiService.createVisit(patientUuid, VISIT_TYPE_UUID, LOCATION_UUID).catch(() => null);
        }

        if (openmrsVisit) {
          encounterData = {
            encounterType: CONSULTATION_ENCOUNTER_TYPE,
            patient: patientUuid,
            visit: openmrsVisit.uuid,
            location: LOCATION_UUID,
            form: CONSULTATION_FORM_UUID,
            encounterProviders: [
              {
                provider: localStorage.getItem('providerUuid') || 'f9badd80-ab76-11e2-9e96-0800200c9a66',
                encounterRole: 'a0b03050-c99b-11e0-9572-0800200c9a66',
              },
            ],
            obs: [] as any[],
          };
        }
      } catch (openmrsError) {
        console.warn('OpenMRS API not available, proceeding with primary API only:', openmrsError);
      }

      // Helper function to add observations (only if encounterData exists)
      const addObs = (concept: string, value: string | number) => {
        if (encounterData && value !== '' && value !== null && value !== undefined) {
          encounterData.obs.push({ concept, value });
        }
      };

      const addYesNoObs = (concept: string, value: YesNoValue) => {
        if (encounterData) {
          if (value === 'yes') {
            encounterData.obs.push({ concept, value: CONCEPTS.YES });
          } else if (value === 'no') {
            encounterData.obs.push({ concept, value: CONCEPTS.NO });
          }
        }
      };

      // Page 1: Complaints & History
      addObs(CONCEPTS.PRESENTING_COMPLAINT, presentingComplaint);
      addObs(CONCEPTS.HISTORY_COMPLAINT, historyComplaint);
      addYesNoObs(CONCEPTS.PREGNANCY_STATUS, pregnancyStatus);

      // Page 2: Constitutional Symptoms
      addYesNoObs(CONCEPTS.WEIGHT_LOSS, weightLoss);
      addYesNoObs(CONCEPTS.ANOREXIA, anorexia);
      addYesNoObs(CONCEPTS.WEIGHT_GAIN, weightGain);
      addYesNoObs(CONCEPTS.FEVER, fever);
      addYesNoObs(CONCEPTS.CHILLS, chills);
      addYesNoObs(CONCEPTS.JAUNDICE, jaundice);
      addYesNoObs(CONCEPTS.LACK_ENERGY, lackEnergy);

      // Musculoskeletal
      addYesNoObs(CONCEPTS.JOINT_STIFFNESS, jointStiffness);
      addYesNoObs(CONCEPTS.MUSCLE_WEAKNESS, muscleWeakness);
      addYesNoObs(CONCEPTS.KNEE_PAIN, kneePain);
      addYesNoObs(CONCEPTS.NECK_PAIN, neckPain);
      addYesNoObs(CONCEPTS.MUSCLE_PAIN, musclePain);
      addYesNoObs(CONCEPTS.MUSCLE_STIFFNESS, muscleStiffness);

      // Gastrointestinal
      addYesNoObs(CONCEPTS.ABDOMINAL_PAIN, abdominalPain);
      addYesNoObs(CONCEPTS.CONSTIPATION, constipation);
      addYesNoObs(CONCEPTS.DENTAL_PROBLEMS, dentalProblems);
      addYesNoObs(CONCEPTS.DIARRHEA, diarrhea);
      addYesNoObs(CONCEPTS.DYSPHAGIA, dysphagia);
      addYesNoObs(CONCEPTS.ODYNOPHAGIA, odynophagia);

      addObs(CONCEPTS.ADDITIONAL_QUESTIONING, additionalQuestioning);

      // Page 3: Medical History
      addObs(CONCEPTS.PAST_MEDICAL_HISTORY, pastMedicalHistory);
      addObs(CONCEPTS.OBS_GYN_HISTORY, obsGynHistory);
      addObs(CONCEPTS.DEVELOPMENT_HISTORY, developmentHistory);
      addObs(CONCEPTS.SURGICAL_HISTORY, surgicalHistory);
      addObs(CONCEPTS.DRUG_HISTORY, drugHistory);
      addObs(CONCEPTS.FAMILY_HISTORY, familyHistory);
      addObs(CONCEPTS.SOCIAL_HISTORY, socialHistory);

      // Page 4: Physical Examination
      addObs(CONCEPTS.GENERAL_OBSERVATIONS, generalObservations);
      addObs(CONCEPTS.BLOOD_PRESSURE, bloodPressure);
      addObs(CONCEPTS.PULSE, pulse);
      addObs(CONCEPTS.CARDIO_NOTES, cardioNotes);
      addObs(CONCEPTS.RESPIRATORY_NOTES, respiratoryNotes);
      addObs(CONCEPTS.ABDOMINAL_EXAM, abdominalExam);
      addObs(CONCEPTS.CNS_EXAM, cnsExam);
      addObs(CONCEPTS.ENT_EXAM, entExam);
      addObs(CONCEPTS.GENITOURINARY_EXAM, genitourinaryExam);
      addObs(CONCEPTS.MUSCULOSKELETAL_EXAM, musculoskeletalExam);
      addObs(CONCEPTS.EYE_EXAM, eyeExam);
      addObs(CONCEPTS.STATUS_LOCALIS, statusLocalis);
      addObs(CONCEPTS.SKIN_EXAM, skinExam);

      // Page 5: Diagnosis
      const diagnosisTypeUuid =
        diagnosisType === 'provisional' ? CONCEPTS.PROVISIONAL_DIAGNOSIS :
        diagnosisType === 'final' ? CONCEPTS.FINAL_DIAGNOSIS :
        CONCEPTS.QUERY_DIAGNOSIS;

      addObs(CONCEPTS.DIAGNOSIS_TYPE, diagnosisTypeUuid);

      // Save diagnosis text (either from selection or custom input)
      const finalDiagnosisText = useCustomDiagnosis ? customDiagnosisText : workingDiagnosis;
      addObs(CONCEPTS.WORKING_DIAGNOSIS, finalDiagnosisText);

      // Step 4: Create encounter in OpenMRS (optional, for backward compatibility)
      let openmrsEncounter = null;
      if (encounterData) {
        try {
          openmrsEncounter = await apiService.createEncounter(encounterData);

          // Add coded diagnosis if available (better for analytics grouping)
          if (diagnosisConceptUuid && !useCustomDiagnosis && openmrsEncounter) {
            const certainty = diagnosisType === 'final' ? 'CONFIRMED' : 'PRESUMED';
            await apiService.addDiagnosis(openmrsEncounter.uuid, patientUuid, diagnosisConceptUuid, certainty).catch(() => {});
            console.log('✅ Coded diagnosis added for analytics:', workingDiagnosis);
          } else if (useCustomDiagnosis) {
            console.log('✅ Custom text diagnosis saved for analytics:', customDiagnosisText);
          }
        } catch (openmrsError) {
          console.warn('OpenMRS encounter creation failed, proceeding with primary API only:', openmrsError);
        }
      }

      // Step 5: Create encounter (primary storage for Clinical Notes tab)
      // Build a summary for quick preview
      const consultationNotes = [
        presentingComplaint && `Presenting Complaint: ${presentingComplaint}`,
        historyComplaint && `History: ${historyComplaint}`,
        generalObservations && `General Observations: ${generalObservations}`,
        finalDiagnosisText && `Diagnosis: ${finalDiagnosisText}`,
      ].filter(Boolean).join('\n\n');

      // Get current logged-in user's display name
      const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
      const providerName = adminUser.displayName || adminUser.username || 'Unknown User';

      // Build structured consultation data for detailed view
      const structuredData = {
        // Complaints & History
        complaintsHistory: {
          presentingComplaint: presentingComplaint || null,
          historyOfComplaint: historyComplaint || null,
          pregnancyStatus: pregnancyStatus || null,
        },
        // Review of Systems - Constitutional
        reviewOfSystems: {
          constitutional: {
            weightLoss: weightLoss || null,
            anorexia: anorexia || null,
            weightGain: weightGain || null,
            fever: fever || null,
            chills: chills || null,
            jaundice: jaundice || null,
            lackOfEnergy: lackEnergy || null,
          },
          musculoskeletal: {
            jointStiffness: jointStiffness || null,
            muscleWeakness: muscleWeakness || null,
            kneePain: kneePain || null,
            neckPain: neckPain || null,
            musclePain: musclePain || null,
            muscleStiffness: muscleStiffness || null,
          },
          gastrointestinal: {
            abdominalPain: abdominalPain || null,
            constipation: constipation || null,
            dentalProblems: dentalProblems || null,
            diarrhea: diarrhea || null,
            difficultySwallowing: dysphagia || null,
            painfulSwallowing: odynophagia || null,
          },
          additionalNotes: additionalQuestioning || null,
        },
        // Medical History
        medicalHistory: {
          pastMedicalHistory: pastMedicalHistory || null,
          obsGynHistory: obsGynHistory || null,
          developmentHistory: developmentHistory || null,
          surgicalHistory: surgicalHistory || null,
          drugHistory: drugHistory || null,
          familyHistory: familyHistory || null,
          socialHistory: socialHistory || null,
        },
        // Physical Examination
        physicalExamination: {
          generalObservations: generalObservations || null,
          vitals: {
            bloodPressure: bloodPressure || null,
            pulse: pulse || null,
          },
          cardiovascular: cardioNotes || null,
          respiratory: respiratoryNotes || null,
          abdominal: abdominalExam || null,
          cns: cnsExam || null,
          ent: entExam || null,
          genitourinary: genitourinaryExam || null,
          musculoskeletal: musculoskeletalExam || null,
          eye: eyeExam || null,
          statusLocalis: statusLocalis || null,
          skin: skinExam || null,
        },
        // Diagnosis
        diagnosisInfo: {
          type: diagnosisType,
          diagnosis: finalDiagnosisText || null,
          conceptUuid: diagnosisConceptUuid || null,
          isCustom: useCustomDiagnosis,
        },
      };

      // Check if we're editing an existing encounter
      if (isEditing && existingEncounter?.id) {
        // Update existing encounter
        const updatePayload = {
          notes: consultationNotes || 'Consultation completed',
          diagnosis: finalDiagnosisText || null,
          structuredData: structuredData,
          updatedBy: adminUser.username || 'admin',
        };

        await apiService.updateEncounter(existingEncounter.id, updatePayload);
        console.log('✅ Consultation encounter updated');
      } else {
        // Create new encounter
        const encounterPayload = {
          patientId: patientDocId,
          visitId: firestoreVisit.id,
          patientName: patientName,
          encounterType: 'Consultation',
          location: 'OKB Clinic',
          provider: localStorage.getItem('providerUuid') || adminUser.username || 'admin',
          providerName: providerName,
          encounterDatetime: now.toISOString(),
          notes: consultationNotes || 'Consultation completed',
          diagnosis: finalDiagnosisText || null,
          structuredData: structuredData,
        };

        await apiService.createEncounter(encounterPayload);
        console.log('✅ Consultation encounter created');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error saving consultation:', err);
      setError(err.message || 'Failed to save consultation');
    } finally {
      setLoading(false);
    }
  };

  const renderYesNoRadios = (
    label: string,
    value: YesNoValue,
    onChange: (value: YesNoValue) => void
  ) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-100">
      <label className="text-sm text-gray-700">{label}</label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={label}
            value="yes"
            checked={value === 'yes'}
            onChange={() => onChange('yes')}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm">Yes</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={label}
            value="no"
            checked={value === 'no'}
            onChange={() => onChange('no')}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm">No</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white   w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${viewMode ? 'bg-green-100' : isEditing ? 'bg-amber-100' : 'bg-blue-100'}`}>
              <Stethoscope className={`h-6 w-6 ${viewMode ? 'text-green-600' : isEditing ? 'text-amber-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {viewMode ? 'Consultation Details' : isEditing ? 'Edit Consultation' : 'General Consultation'}
              </h2>
              <p className="text-sm text-gray-600">{patientName}</p>
              {(viewMode || isEditing) && existingEncounter && (
                <p className="text-xs text-gray-500 mt-1">
                  {existingEncounter.encounterDatetime?.toDate
                    ? existingEncounter.encounterDatetime.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : existingEncounter.encounterDatetime
                      ? new Date(existingEncounter.encounterDatetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : ''
                  } • {existingEncounter.providerName || 'Unknown Provider'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {viewMode && existingEncounter && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
              >
                Edit Diagnosis
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-gray-200 overflow-x-auto">
          <div className="flex px-6 min-w-max">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === index
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Tab 0: Complaints & History */}
            {activeTab === 0 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Presenting Complaint(s) {!viewMode && '*'}
                  </label>
                  <textarea
                    value={presentingComplaint}
                    onChange={(e) => !viewMode && setPresentingComplaint(e.target.value)}
                    rows={3}
                    required={!viewMode}
                    readOnly={viewMode}
                    className={`w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${viewMode ? 'bg-gray-50 cursor-default' : ''}`}
                    placeholder={viewMode ? 'Not recorded' : 'Enter the main reason for visit...'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    History of Complaint(s) {!viewMode && '*'}
                  </label>
                  <textarea
                    value={historyComplaint}
                    onChange={(e) => !viewMode && setHistoryComplaint(e.target.value)}
                    rows={4}
                    required={!viewMode}
                    readOnly={viewMode}
                    className={`w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${viewMode ? 'bg-gray-50 cursor-default' : ''}`}
                    placeholder={viewMode ? 'Not recorded' : 'Detailed description of the complaint...'}
                  />
                </div>

                {/* Pregnancy status - only shown for females aged 15-49 (WHO reproductive age) */}
                {showPregnancyStatus && (
                  <div className="p-4 bg-pink-50 border border-pink-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Is Patient Pregnant As At Now?
                    </label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="yes"
                          checked={pregnancyStatus === 'yes'}
                          onChange={() => setPregnancyStatus('yes')}
                          className="w-4 h-4 text-pink-600"
                        />
                        <span className="text-sm">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="no"
                          checked={pregnancyStatus === 'no'}
                          onChange={() => setPregnancyStatus('no')}
                          className="w-4 h-4 text-pink-600"
                        />
                        <span className="text-sm">No</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 1: Review of Systems */}
            {activeTab === 1 && (
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 ">
                  <h3 className="font-medium text-gray-900 mb-3">Constitutional Symptoms</h3>
                  {renderYesNoRadios('Abnormal Weight Loss', weightLoss, setWeightLoss)}
                  {renderYesNoRadios('Anorexia', anorexia, setAnorexia)}
                  {renderYesNoRadios('Excessive Weight Gain', weightGain, setWeightGain)}
                  {renderYesNoRadios('Fever', fever, setFever)}
                  {renderYesNoRadios('Chills', chills, setChills)}
                  {renderYesNoRadios('Jaundice', jaundice, setJaundice)}
                  {renderYesNoRadios('Lack Of Energy', lackEnergy, setLackEnergy)}
                </div>

                <div className="p-4 bg-gray-50 ">
                  <h3 className="font-medium text-gray-900 mb-3">Musculoskeletal System</h3>
                  {renderYesNoRadios('Joint Stiffness', jointStiffness, setJointStiffness)}
                  {renderYesNoRadios('Muscle Weakness', muscleWeakness, setMuscleWeakness)}
                  {renderYesNoRadios('Knee Joint Pain', kneePain, setKneePain)}
                  {renderYesNoRadios('Neck Pain', neckPain, setNeckPain)}
                  {renderYesNoRadios('Muscle Pain', musclePain, setMusclePain)}
                  {renderYesNoRadios('Muscle Stiffness', muscleStiffness, setMuscleStiffness)}
                </div>

                <div className="p-4 bg-gray-50 ">
                  <h3 className="font-medium text-gray-900 mb-3">Gastrointestinal Tract</h3>
                  {renderYesNoRadios('Abdominal Pain', abdominalPain, setAbdominalPain)}
                  {renderYesNoRadios('Constipation', constipation, setConstipation)}
                  {renderYesNoRadios('Dental Problems', dentalProblems, setDentalProblems)}
                  {renderYesNoRadios('Diarrhea', diarrhea, setDiarrhea)}
                  {renderYesNoRadios('Dysphagia', dysphagia, setDysphagia)}
                  {renderYesNoRadios('Odynophagia', odynophagia, setOdynophagia)}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional On Direct Questioning
                  </label>
                  <textarea
                    value={additionalQuestioning}
                    onChange={(e) => setAdditionalQuestioning(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any additional symptoms or findings..."
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Medical History */}
            {activeTab === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Past Medical History(s)
                  </label>
                  <textarea
                    value={pastMedicalHistory}
                    onChange={(e) => setPastMedicalHistory(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Previous illnesses, chronic conditions..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Obstetrics/Gynecological History(s)
                  </label>
                  <textarea
                    value={obsGynHistory}
                    onChange={(e) => setObsGynHistory(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Pregnancy history, menstrual history, etc..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Development History(s) (For Infants and Children)
                  </label>
                  <textarea
                    value={developmentHistory}
                    onChange={(e) => setDevelopmentHistory(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Developmental milestones, growth history..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Past Surgical History(s)
                  </label>
                  <textarea
                    value={surgicalHistory}
                    onChange={(e) => setSurgicalHistory(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Previous surgeries, dates, outcomes..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Drug History(s)
                  </label>
                  <textarea
                    value={drugHistory}
                    onChange={(e) => setDrugHistory(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Current medications, allergies..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Family History(s)
                  </label>
                  <textarea
                    value={familyHistory}
                    onChange={(e) => setFamilyHistory(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Family medical conditions, hereditary diseases..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Social History(s)
                  </label>
                  <textarea
                    value={socialHistory}
                    onChange={(e) => setSocialHistory(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Occupation, lifestyle, smoking, alcohol use..."
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Physical Examination */}
            {activeTab === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    General Observation / Review
                  </label>
                  <textarea
                    value={generalObservations}
                    onChange={(e) => setGeneralObservations(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="General appearance, level of distress, etc..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Blood Pressure (mmHg)
                    </label>
                    <input
                      type="text"
                      value={bloodPressure}
                      onChange={(e) => setBloodPressure(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 120/80"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pulse (B/Min)
                    </label>
                    <input
                      type="number"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 72"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cardiovascular System Notes
                  </label>
                  <textarea
                    value={cardioNotes}
                    onChange={(e) => setCardioNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Heart sounds, murmurs, etc..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Respiratory System Notes
                  </label>
                  <textarea
                    value={respiratoryNotes}
                    onChange={(e) => setRespiratoryNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Breath sounds, respiratory effort..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Abdominal Examination Findings
                  </label>
                  <textarea
                    value={abdominalExam}
                    onChange={(e) => setAbdominalExam(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Inspection, palpation, percussion, auscultation..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CNS Examination
                  </label>
                  <textarea
                    value={cnsExam}
                    onChange={(e) => setCnsExam(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Neurological findings..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ENT Examination
                  </label>
                  <textarea
                    value={entExam}
                    onChange={(e) => setEntExam(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ear, nose, throat findings..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Eye Examination
                  </label>
                  <textarea
                    value={eyeExam}
                    onChange={(e) => setEyeExam(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Visual acuity, eye movements, etc..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Genitourinary System Examination
                  </label>
                  <textarea
                    value={genitourinaryExam}
                    onChange={(e) => setGenitourinaryExam(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="GU findings..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Musculoskeletal System Examination
                  </label>
                  <textarea
                    value={musculoskeletalExam}
                    onChange={(e) => setMusculoskeletalExam(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Joint examination, range of motion..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skin Examination
                  </label>
                  <textarea
                    value={skinExam}
                    onChange={(e) => setSkinExam(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Skin findings, rashes, lesions..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status Localis
                  </label>
                  <textarea
                    value={statusLocalis}
                    onChange={(e) => setStatusLocalis(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Local examination findings..."
                  />
                </div>
              </div>
            )}

            {/* Tab 4: Diagnosis */}
            {activeTab === 4 && (
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 ">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Diagnosis Type
                  </label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="provisional"
                        checked={diagnosisType === 'provisional'}
                        onChange={() => setDiagnosisType('provisional')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm">Provisional diagnosis</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="final"
                        checked={diagnosisType === 'final'}
                        onChange={() => setDiagnosisType('final')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm">Final diagnosis</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="query"
                        checked={diagnosisType === 'query'}
                        onChange={() => setDiagnosisType('query')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm">Query diagnosis</span>
                    </label>
                  </div>
                </div>

                {/* Diagnosis Search */}
                <div className="space-y-4">
                  {/* Search for Diagnosis from OpenMRS */}
                  <div ref={searchRef} className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Diagnosis *
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={diagnosisSearchTerm}
                        onChange={(e) => setDiagnosisSearchTerm(e.target.value)}
                        onFocus={() => {
                          if (searchResults.length > 0) {
                            setShowSearchResults(true);
                          }
                        }}
                        placeholder="Type to search diagnoses..."
                        className="w-full pl-10 pr-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                      )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showSearchResults && searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300   max-h-60 overflow-y-auto">
                        {searchResults.map((result) => (
                          <button
                            key={result.uuid}
                            type="button"
                            onClick={() => {
                              setDiagnosisConceptUuid(result.uuid);
                              setWorkingDiagnosis(result.display);
                              setDiagnosisSearchTerm(result.display);
                              setShowSearchResults(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none text-sm"
                          >
                            {result.display}
                          </button>
                        ))}
                      </div>
                    )}

                    {showSearchResults && searchResults.length === 0 && diagnosisSearchTerm.length >= 2 && !isSearching && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300   p-4">
                        <p className="text-sm text-gray-500 text-center">No diagnoses found</p>
                      </div>
                    )}

                    <p className="mt-1 text-xs text-gray-500">
                      Type at least 2 characters to search
                    </p>
                  </div>

                  {/* Selected Diagnosis Display */}
                  {workingDiagnosis && !useCustomDiagnosis && (
                    <div className="p-3 bg-blue-50 border border-blue-200 ">
                      <p className="text-sm font-medium text-blue-900">
                        Selected: {workingDiagnosis}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        ✓ Coded diagnosis - will be grouped in analytics
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-600 text-center">
                  Can't find it? Use custom diagnosis below
                </p>

                {/* OR Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">OR</span>
                  </div>
                </div>

                {/* Custom/Free-text Diagnosis */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="useCustomDiagnosis"
                      checked={useCustomDiagnosis}
                      onChange={(e) => {
                        setUseCustomDiagnosis(e.target.checked);
                        if (e.target.checked) {
                          // Clear coded diagnosis selections
                          setDiagnosisConceptUuid('');
                          setWorkingDiagnosis('');
                          setDiagnosisSearchTerm('');
                        } else {
                          // Clear custom diagnosis
                          setCustomDiagnosisText('');
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="useCustomDiagnosis" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Enter custom diagnosis (not in OpenMRS)
                    </label>
                  </div>

                  {useCustomDiagnosis && (
                    <textarea
                      value={customDiagnosisText}
                      onChange={(e) => setCustomDiagnosisText(e.target.value)}
                      rows={3}
                      required={useCustomDiagnosis}
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Type your custom diagnosis..."
                    />
                  )}
                </div>

                {/* Optional: Additional notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any additional notes about the diagnosis..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional notes for clinical records
                  </p>
                </div>
              </div>
            )}

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 ">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 ">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-700">Consultation saved successfully!</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-2">
              {activeTab > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab - 1)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300  hover:bg-gray-50"
                >
                  Previous
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                >
                  Cancel Edit
                </button>
              )}
              {activeTab < tabs.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab + 1)}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
                >
                  Next
                </button>
              ) : viewMode ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700"
                >
                  Close
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || success}
                  className={`flex items-center gap-2 px-6 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                    isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isEditing ? 'Updating...' : 'Saving...'}
                    </>
                  ) : success ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {isEditing ? 'Updated' : 'Saved'}
                    </>
                  ) : (
                    isEditing ? 'Save Changes' : 'Save Consultation'
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
