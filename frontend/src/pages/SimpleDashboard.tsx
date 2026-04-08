"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import {
  Calendar,
  FileText,
  Heart,
  LogOut,
  MoreHorizontal,
  Pill,
  RefreshCw,
  TestTube,
  TrendingDown,
  TrendingUp,
  User,
  Shield,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  X,
  Award,
  Activity,
  ChevronDown,
  Clock,
  Menu,
  MapPin,
  ArrowLeft,
  Search,
  Loader2,
  Plus,
  Stethoscope,
  CreditCard,
  Phone,
  File as FileIcon,
  Send,
  Edit2,
  Save,
  Brain,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import apiService from "../services/api.service"
import VitalsForm from "../components/admin/VitalsForm"
import ConsultationForm from "../components/admin/ConsultationForm"
import AddOrderForm from "../components/admin/AddOrderForm"
import ClinicalNoteForm from "../components/admin/ClinicalNoteForm"
import ReferPatientModal from "../components/admin/ReferPatientModal"
import FollowUpModal from "../components/admin/FollowUpModal"
import AskHope from "../components/admin/AskHope"
import NCDAlerts from "../components/admin/NCDAlerts"
import { CalendarClock } from "lucide-react"

interface SimpleDashboardProps {
  patientUuid?: string // Optional prop for admin view
  isAdminView?: boolean // Flag to indicate admin is viewing
  onBack?: () => void // Optional callback for back navigation
  initialTab?: string // Optional initial tab to show (from notification click)
  notificationType?: 'lab' | 'medication' // Type of notification clicked
  notificationOrderId?: string // ID of the order to show details for
}

const SimpleDashboard: React.FC<SimpleDashboardProps> = ({
  patientUuid: propPatientUuid,
  isAdminView = false,
  onBack,
  initialTab,
  notificationType,
  notificationOrderId,
}) => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [patientData, setPatientData] = useState<CompletePatientData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [askHopeOpen, setAskHopeOpen] = useState(false)

  // AI loading status
  const [aiStatus, setAiStatus] = useState<{
    loading: boolean;
    loaded: boolean;
    error: string | null;
    progress: string;
  }>({ loading: false, loaded: false, error: null, progress: 'Checking...' })

  // Get current user role from localStorage
  const getCurrentUserRole = () => {
    try {
      const adminUser = localStorage.getItem('admin_user');
      if (adminUser) {
        const user = JSON.parse(adminUser);
        return user.role || 'admin';
      }
    } catch (error) {
      console.error('Error getting user role:', error);
    }
    return 'admin'; // Default to admin if no role found
  };

  const userRole = getCurrentUserRole();

  // Set initial active tab based on role or notification
  const getInitialTab = () => {
    if (initialTab) return initialTab; // Use notification tab if provided
    if (userRole === 'nurse') return 'vitals';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab())

  // Admin search states
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Form modals state
  const [showAddVisitMenu, setShowAddVisitMenu] = useState(false)
  const [showAddOrderMenu, setShowAddOrderMenu] = useState(false)
  const [showVitalsForm, setShowVitalsForm] = useState(false)
  const [showConsultationForm, setShowConsultationForm] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [showClinicalNoteForm, setShowClinicalNoteForm] = useState(false)
  const [orderFormType, setOrderFormType] = useState<'medication' | 'lab'>('medication')
  const [showPatientDetailsModal, setShowPatientDetailsModal] = useState(false)
  const [showReferPatientModal, setShowReferPatientModal] = useState(false)
  const [showFollowUpModal, setShowFollowUpModal] = useState(false)
  const [isEditingPatient, setIsEditingPatient] = useState(false)
  const [patientEditData, setPatientEditData] = useState<any>(null)
  const [savingPatient, setSavingPatient] = useState(false)
  const [selectedMedication, setSelectedMedication] = useState<any | null>(null)
  const [editingMedication, setEditingMedication] = useState(false)
  const [medicationEditData, setMedicationEditData] = useState<any>(null)
  const [medicationActionLoading, setMedicationActionLoading] = useState(false)
  const [selectedLabTest, setSelectedLabTest] = useState<any | null>(null)
  const [selectedClinicalNote, setSelectedClinicalNote] = useState<any | null>(null)
  const [selectedEncounter, setSelectedEncounter] = useState<any | null>(null)
  const addVisitRef = useRef<HTMLDivElement>(null)
  const addOrderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadPatientData()
  }, [propPatientUuid])

  // Poll AI loading status
  useEffect(() => {
    const checkAiStatus = async () => {
      try {
        const response = await fetch('http://localhost:8080/ai-loading-status');
        const status = await response.json();
        setAiStatus(status);

        // Stop polling once loaded or errored
        if (status.loaded || status.error) {
          return true; // Stop polling
        }
      } catch (error) {
        console.error('[AI Status] Failed to check:', error);
      }
      return false; // Continue polling
    };

    // Initial check
    checkAiStatus();

    // Poll every 2 seconds while loading
    const interval = setInterval(async () => {
      const shouldStop = await checkAiStatus();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Real-time subscriptions for lab orders and prescriptions
  useEffect(() => {
    // Get patient ID from prop or localStorage
    let patientId = propPatientUuid;
    if (!patientId) {
      patientId = localStorage.getItem("openmrs_patient_uuid") || undefined;
    }
    if (!patientId) return;

    // Subscribe to lab orders - updates in real-time when lab status changes
    const unsubscribeLab = apiService.subscribeToPatientLabOrders(patientId, (labOrders) => {
      setPatientData((prev) => {
        if (!prev) return prev;
        return { ...prev, labOrders };
      });
    });

    // Subscribe to pharmacy orders - updates in real-time when medication is ordered or dispensed
    const unsubscribePharmacy = apiService.subscribeToPatientPharmacyOrders(patientId, (pharmacyOrders) => {
      setPatientData((prev) => {
        if (!prev) return prev;
        return { ...prev, pharmacyOrders };
      });
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeLab();
      unsubscribePharmacy();
    };
  }, [propPatientUuid])

  // Auto-open modal when notification data is provided
  useEffect(() => {
    if (patientData && notificationOrderId && notificationType) {
      if (notificationType === 'lab') {
        // Find the lab test with matching ID and open its modal
        const labTest = patientData.labOrders?.find(
          (test: any) => test.id === notificationOrderId || test.uuid === notificationOrderId
        );
        if (labTest) {
          setSelectedLabTest(labTest);
        }
      } else if (notificationType === 'medication') {
        // Find the medication with matching ID and open its modal
        const medication = patientData.pharmacyOrders?.find(
          (med: any) => med.id === notificationOrderId || med.uuid === notificationOrderId
        );
        if (medication) {
          setSelectedMedication(medication);
        }
      }
    }
  }, [patientData, notificationOrderId, notificationType])

  // Debug: Log patient data when modal opens
  useEffect(() => {
    if (showPatientDetailsModal && patientData?.patient) {
      console.log('Patient data in modal:', patientData.patient);
      console.log('Religion:', (patientData.patient as any).religion);
      console.log('Occupation:', (patientData.patient as any).occupation);
      console.log('Marital Status:', (patientData.patient as any).maritalStatus);
      console.log('Education Level:', (patientData.patient as any).educationLevel);
      console.log('Emergency Contact:', {
        name: (patientData.patient as any).emergencyContactName,
        phone: (patientData.patient as any).emergencyContactPhone,
        relationship: (patientData.patient as any).emergencyContactRelationship,
      });
      console.log('Ghana Card:', (patientData.patient as any).ghanaCardNumber);
      console.log('NHIS:', (patientData.patient as any).nhisNumber);
    }
  }, [showPatientDetailsModal, patientData])

  // Initialize edit data when entering edit mode
  useEffect(() => {
    if (isEditingPatient && patientData?.patient) {
      const patient = patientData.patient as any;
      setPatientEditData({
        phoneNumber: patient.phoneNumber || '',
        email: patient.email || '',
        address: {
          line1: patient.address?.line1 || '',
          line2: patient.address?.line2 || '',
          city: patient.address?.city || '',
          state: patient.address?.state || '',
        },
        community: patient.community || '',
        religion: patient.religion || '',
        occupation: patient.occupation || '',
        maritalStatus: patient.maritalStatus || '',
        educationLevel: patient.educationLevel || '',
        emergencyContactName: patient.emergencyContactName || '',
        emergencyContactPhone: patient.emergencyContactPhone || '',
        emergencyContactRelationship: patient.emergencyContactRelationship || '',
        ghanaCardNumber: patient.ghanaCardNumber || '',
        nhisNumber: patient.nhisNumber || '',
      });
    }
  }, [isEditingPatient, patientData])

  const handleEditPatient = () => {
    setIsEditingPatient(true);
  };

  const handleCancelEdit = () => {
    setIsEditingPatient(false);
    setPatientEditData(null);
  };

  const handleSavePatient = async () => {
    if (!patientData?.patient) return;

    try {
      setSavingPatient(true);
      const patientId = getPatientUuid(patientData.patient);
      
      const updates: any = {
        phoneNumber: patientEditData.phoneNumber || null,
        email: patientEditData.email || null,
        address: {
          line1: patientEditData.address.line1 || null,
          line2: patientEditData.address.line2 || null,
          city: patientEditData.address.city || null,
          state: patientEditData.address.state || null,
          country: patientEditData.address.country || null,
        },
        community: patientEditData.community || null,
        religion: patientEditData.religion || null,
        occupation: patientEditData.occupation || null,
        maritalStatus: patientEditData.maritalStatus || null,
        educationLevel: patientEditData.educationLevel || null,
        emergencyContactName: patientEditData.emergencyContactName || null,
        emergencyContactPhone: patientEditData.emergencyContactPhone || null,
        emergencyContactRelationship: patientEditData.emergencyContactRelationship || null,
        ghanaCardNumber: patientEditData.ghanaCardNumber || null,
        nhisNumber: patientEditData.nhisNumber || null,
      };

      await apiService.updatePatient(patientId, updates);
      
      // Reload patient data to show updated information
      await loadPatientData();
      setIsEditingPatient(false);
      setPatientEditData(null);
    } catch (error: any) {
      console.error('Error updating patient:', error);
      alert('Failed to update patient information: ' + (error.message || 'Unknown error'));
    } finally {
      setSavingPatient(false);
    }
  };

  // Medication edit handlers
  const handleEditMedication = () => {
    if (!selectedMedication) return;
    setMedicationEditData({
      dosage: selectedMedication.dosage || '',
      instructions: selectedMedication.instructions || '',
      quantity: selectedMedication.quantity?.toString() || '1',
    });
    setEditingMedication(true);
  };

  const handleCancelMedicationEdit = () => {
    setEditingMedication(false);
    setMedicationEditData(null);
  };

  const handleSaveMedicationEdit = async () => {
    if (!selectedMedication?.id || !medicationEditData) return;

    try {
      setMedicationActionLoading(true);
      await apiService.updatePharmacyOrder(selectedMedication.id, {
        dosage: medicationEditData.dosage,
        instructions: medicationEditData.instructions,
        quantity: parseInt(medicationEditData.quantity) || 1,
      });

      // Update local state
      setSelectedMedication({
        ...selectedMedication,
        dosage: medicationEditData.dosage,
        instructions: medicationEditData.instructions,
        quantity: parseInt(medicationEditData.quantity) || 1,
      });
      setEditingMedication(false);
      setMedicationEditData(null);

      // The real-time subscription will update the list automatically
    } catch (error: any) {
      console.error('Error updating medication:', error);
      alert('Failed to update medication: ' + (error.message || 'Unknown error'));
    } finally {
      setMedicationActionLoading(false);
    }
  };

  const handleCancelMedicationOrder = async () => {
    if (!selectedMedication?.id) return;

    if (!confirm('Are you sure you want to cancel this medication order? This action cannot be undone.')) {
      return;
    }

    try {
      setMedicationActionLoading(true);
      await apiService.deletePharmacyOrder(selectedMedication.id);
      setSelectedMedication(null);
      // The real-time subscription will update the list automatically
    } catch (error: any) {
      console.error('Error canceling medication order:', error);
      alert('Failed to cancel medication order: ' + (error.message || 'Unknown error'));
    } finally {
      setMedicationActionLoading(false);
    }
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
      if (addVisitRef.current && !addVisitRef.current.contains(event.target as Node)) {
        setShowAddVisitMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Search for patients (debounced)
  useEffect(() => {
    if (!isAdminView || !searchQuery.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    const timeoutId = setTimeout(async () => {
      try {
        setSearching(true)
        const results = await apiService.adminSearchPatients(searchQuery, "name")
        setSearchResults(results)
        setShowSearchResults(true)
      } catch (error) {
        console.error("Error searching patients:", error)
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery, isAdminView])

  const handlePatientSelect = (patientUuid: string) => {
    setShowSearchResults(false)
    setSearchQuery("")
    navigate(`/admin/patient-portal/${patientUuid}`)
  }

  // Helper functions to extract patient data (works with both Firestore and OpenMRS structures)
  const getPatientName = (patient: any) => {
    if (!patient) return 'Unknown Patient';
    // FastAPI backend structure (has full_name computed field)
    if (patient.full_name) {
      return patient.full_name;
    }
    // FastAPI backend snake_case structure
    if (patient.first_name || patient.last_name) {
      return `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    }
    // Firestore structure (camelCase)
    if (patient.firstName || patient.lastName) {
      return `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
    }
    // OpenMRS structure
    if (patient.person?.display) {
      return patient.person.display;
    }
    if (patient.person?.preferredName?.display) {
      return patient.person.preferredName.display;
    }
    return 'Unknown Patient';
  };

  const getPatientId = (patient: any) => {
    if (!patient) return 'N/A';
    // Firestore structure
    if (patient.identifier) return patient.identifier;
    // OpenMRS structure
    if (patient.identifiers?.[0]?.identifier) return patient.identifiers[0].identifier;
    // Fallback to document ID
    if (patient.id) return patient.id;
    return 'N/A';
  };

  const getPatientUuid = (patient: any) => {
    if (!patient) return '';
    // Firestore uses 'id', OpenMRS uses 'uuid'
    return patient.id || patient.uuid || '';
  };

  const getPatientGender = (patient: any) => {
    if (!patient) return 'U';
    // Firestore structure
    if (patient.gender) return patient.gender;
    // OpenMRS structure
    if (patient.person?.gender) return patient.person.gender;
    return 'U';
  };

  const formatBirthdate = (patient: any) => {
    if (!patient) return null;
    
    let birthdate: Date | null = null;
    let isEstimated = false;

    // Firestore structure
    if (patient.birthdate) {
      if (patient.birthdate.toDate) {
        // Firestore Timestamp
        birthdate = patient.birthdate.toDate();
      } else if (typeof patient.birthdate === 'string') {
        birthdate = new Date(patient.birthdate);
      } else if (patient.birthdate instanceof Date) {
        birthdate = patient.birthdate;
      }
      isEstimated = patient.birthdateEstimated || false;
    }
    // OpenMRS structure
    else if (patient.person?.birthdate) {
      birthdate = new Date(patient.person.birthdate);
      isEstimated = patient.person.birthdateEstimated || false;
    }

    if (!birthdate || isNaN(birthdate.getTime())) return null;

    return {
      date: birthdate,
      formatted: birthdate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      isEstimated,
    };
  };

  const loadPatientData = async () => {
    try {
      setLoading(true)
      setError(null)

      // If patientUuid prop is provided (admin view), use it
      // Otherwise, get from localStorage (patient view)
      let patientUuid = propPatientUuid

      if (!patientUuid) {
        const customAuth = localStorage.getItem("custom_auth")
        patientUuid = localStorage.getItem("openmrs_patient_uuid") || undefined

        if (!customAuth || !patientUuid) {
          console.log("No authentication found, redirecting to login")
          window.location.href = "/otp-login"
          return
        }
      }

      const completeData = await apiService.getCompletePatientData(patientUuid)

      // Helper to map snake_case observation to camelCase
      const mapObservation = (obs: any) => ({
        ...obs,
        conceptType: obs.conceptType || obs.concept_type,
        conceptDisplay: obs.conceptDisplay || obs.concept_display,
        conceptCode: obs.conceptCode || obs.concept_code,
        // Map value from value_numeric or value_text
        value: obs.value !== undefined ? obs.value : (obs.value_numeric !== undefined ? obs.value_numeric : obs.value_text),
        obsDatetime: obs.obsDatetime || obs.obs_datetime,
      });

      // Helper to map snake_case medication to camelCase
      const mapMedication = (med: any) => ({
        ...med,
        drugName: med.drugName || med.drug_name,
        prescribedDate: med.prescribedDate || med.prescribed_date,
      });

      // Helper to map snake_case diagnosis to camelCase
      const mapDiagnosis = (diag: any) => ({
        ...diag,
        conditionText: diag.conditionText || diag.condition_text,
        diagnosedDate: diag.diagnosedDate || diag.diagnosed_date,
      });

      // Helper to map snake_case allergy to camelCase
      const mapAllergy = (allergy: any) => ({
        ...allergy,
        allergyType: allergy.allergyType || allergy.allergy_type,
        recordedDate: allergy.recordedDate || allergy.recorded_date,
      });

      // Transform backend data to match SimpleDashboard expected structure
      const transformedData = {
        ...completeData,
        // Map observations to vitals (for vitals display) - filter by conceptType and map fields
        vitals: (completeData.observations?.filter((obs: any) =>
          obs.conceptType === 'vital_signs' || obs.concept_type === 'vital_signs'
        ) || []).map(mapObservation),
        // Map observations to labTests (for lab tests display)
        labTests: (completeData.observations?.filter((obs: any) =>
          obs.conceptType === 'Lab Test' || obs.conceptType === 'lab_result' ||
          obs.concept_type === 'lab_test' || obs.concept_type === 'lab_result'
        ) || []).map(mapObservation),
        // Map observations to attachments (notes with images/files)
        attachments: (completeData.observations?.filter((obs: any) =>
          obs.conceptType === 'Clinical Note' || obs.conceptType === 'Text' ||
          obs.concept_type === 'clinical_note' || obs.concept_type === 'text'
        ) || []).map(mapObservation),
        // Keep encounters as is (for Clinical Notes tab - consultation forms)
        encounters: completeData.encounters || [],
        // Include lab orders and pharmacy orders for notification modal opening
        labOrders: completeData.labOrders || [],
        pharmacyOrders: completeData.pharmacyOrders || [],
        // Include medications, allergies, diagnoses with snake_case to camelCase mapping
        medications: (completeData.medications || []).map(mapMedication),
        allergies: (completeData.allergies || []).map(mapAllergy),
        diagnoses: (completeData.diagnoses || []).map(mapDiagnosis),
      };

      setPatientData(transformedData as any)
    } catch (error) {
      console.error("Failed to load patient data:", error)
      setError("Failed to load patient information. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    if (isAdminView) {
      // Admin view: go back to role-specific dashboard
      if (onBack) {
        onBack()
      } else {
        // Route based on user role
        const roleRoutes: Record<string, string> = {
          admin: '/admin',
          doctor: '/admin/doctor',
          nurse: '/admin/nurse',
          registrar: '/admin/registrar',
          pharmacy: '/admin/pharmacy',
          lab: '/admin/lab',
        };
        navigate(roleRoutes[userRole] || '/admin')
      }
    } else {
      // Patient view: logout
      localStorage.removeItem("custom_auth")
      localStorage.removeItem("patient_phone")
      localStorage.removeItem("patient_name")
      localStorage.removeItem("openmrs_patient_uuid")
      window.location.href = "/otp-login"
    }
  }

  const getStatusVariant = (status?: string) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "PENDING":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "CANCELLED":
        return "bg-red-50 text-red-700 border-red-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-100"
    }
  }

  const getVitalStatus = (vital: any) => {
    const value = (vital.value != null && typeof vital.value === "object") ? vital.value.display : (vital.value ?? '')
    const numValue = Number.parseFloat(value)

    if (isNaN(numValue))
      return {
        status: "normal",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        variant: "bg-blue-50 text-blue-700 border-blue-200",
        color: "blue"
      }

    // Get concept name from either Firestore (conceptDisplay/conceptName) or OpenMRS (concept.display)
    const conceptName = vital.conceptDisplay || vital.conceptName || vital.concept?.display || '';
    const conceptNameLower = conceptName.toLowerCase();

    if (conceptNameLower.includes("blood pressure")) {
      if (numValue > 140)
        return {
          status: "elevated",
          icon: <TrendingUp className="h-3.5 w-3.5" />,
          variant: "bg-red-50 text-red-700 border-red-200",
          color: "red"
        }
      if (numValue < 90)
        return {
          status: "low",
          icon: <TrendingDown className="h-3.5 w-3.5" />,
          variant: "bg-amber-50 text-amber-700 border-amber-200",
          color: "amber"
        }
      return {
        status: "normal",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        variant: "bg-emerald-50 text-emerald-700 border-emerald-200",
        color: "emerald"
      }
    }

    return {
      status: "normal",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      variant: "bg-blue-50 text-blue-700 border-blue-200",
      color: "blue"
    }
  }

  const getTotalRecords = () => {
    if (!patientData) return 0
    // Count only meaningful records - exclude empty arrays
    const observationCount = patientData.observations?.length > 0 ? 1 : 0
    const medicationCount = (patientData.pharmacyOrders?.length > 0 || patientData.medications?.length > 0) ? 1 : 0
    const diagnosisCount = patientData.diagnoses?.length > 0 ? 1 : 0
    const visitCount = patientData.visits?.length > 0 ? 1 : 0
    return observationCount + medicationCount + diagnosisCount + visitCount
  }

  const getNextAppointment = () => {
    if (!patientData || !patientData.visits || patientData.visits.length === 0) return null

    // Get the most recent visit as the "next" appointment
    const sortedVisits = [...patientData.visits].sort((a: any, b: any) => {
      const dateA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate || a.startDatetime);
      const dateB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate || b.startDatetime);
      return dateB.getTime() - dateA.getTime();
    })
    return sortedVisits[0]?.startDate || sortedVisits[0]?.startDatetime || null
  }

  const getRecentActivity = () => {
    if (!patientData) return []

    const activities = []

    // Add most recent vital signs (from observations/vitals)
    if (patientData.vitals && patientData.vitals.length > 0) {
      const mostRecentVital = patientData.vitals.sort((a: any, b: any) => {
        const getDateA = () => {
          if (a.obsDatetime?.toDate) return a.obsDatetime.toDate();
          if (a.observationDate?.toDate) return a.observationDate.toDate();
          if (a.createdAt?.toDate) return a.createdAt.toDate();
          if (a.obsDatetime) return new Date(a.obsDatetime);
          if (a.observationDate) return new Date(a.observationDate);
          if (a.createdAt) return new Date(a.createdAt);
          return new Date(0);
        };
        const getDateB = () => {
          if (b.obsDatetime?.toDate) return b.obsDatetime.toDate();
          if (b.observationDate?.toDate) return b.observationDate.toDate();
          if (b.createdAt?.toDate) return b.createdAt.toDate();
          if (b.obsDatetime) return new Date(b.obsDatetime);
          if (b.observationDate) return new Date(b.observationDate);
          if (b.createdAt) return new Date(b.createdAt);
          return new Date(0);
        };
        const dateA = getDateA();
        const dateB = getDateB();
        return dateB.getTime() - dateA.getTime();
      })[0]

      const getVitalDate = () => {
        if (mostRecentVital.obsDatetime?.toDate) return mostRecentVital.obsDatetime.toDate();
        if (mostRecentVital.observationDate?.toDate) return mostRecentVital.observationDate.toDate();
        if (mostRecentVital.createdAt?.toDate) return mostRecentVital.createdAt.toDate();
        if (mostRecentVital.obsDatetime) return new Date(mostRecentVital.obsDatetime);
        if (mostRecentVital.observationDate) return new Date(mostRecentVital.observationDate);
        if (mostRecentVital.createdAt) return new Date(mostRecentVital.createdAt);
        return new Date();
      };
      
      const vitalDate = getVitalDate();
      const vitalDescription = mostRecentVital.conceptName || mostRecentVital.concept?.display || 'Vital signs';

      // Only add if date is valid
      if (vitalDate && !isNaN(vitalDate.getTime())) {
        activities.push({
          id: 1,
          type: "vitals",
          title: "Vital signs recorded",
          description: vitalDescription,
          time: formatRelativeTime(vitalDate.toISOString()),
          date: vitalDate,
          icon: Heart,
          color: "blue"
        })
      }
    }

    // Add most recent medication (from pharmacyOrders)
    const medsSource = patientData.pharmacyOrders || patientData.medications || [];
    if (medsSource.length > 0) {
      const mostRecentMed = [...medsSource].sort((a: any, b: any) => {
        // Try multiple date fields with fallbacks
        const getDateA = () => {
          if (a.orderedDate?.toDate) return a.orderedDate.toDate();
          if (a.dateActivated?.toDate) return a.dateActivated.toDate();
          if (a.prescribedDate?.toDate) return a.prescribedDate.toDate();
          if (a.startDate?.toDate) return a.startDate.toDate();
          if (a.createdAt?.toDate) return a.createdAt.toDate();
          if (a.orderedDate) return new Date(a.orderedDate);
          if (a.dateActivated) return new Date(a.dateActivated);
          if (a.prescribedDate) return new Date(a.prescribedDate);
          if (a.startDate) return new Date(a.startDate);
          if (a.createdAt) return new Date(a.createdAt);
          return new Date(0); // Fallback to epoch if no date found
        };
        const getDateB = () => {
          if (b.orderedDate?.toDate) return b.orderedDate.toDate();
          if (b.dateActivated?.toDate) return b.dateActivated.toDate();
          if (b.prescribedDate?.toDate) return b.prescribedDate.toDate();
          if (b.startDate?.toDate) return b.startDate.toDate();
          if (b.createdAt?.toDate) return b.createdAt.toDate();
          if (b.orderedDate) return new Date(b.orderedDate);
          if (b.dateActivated) return new Date(b.dateActivated);
          if (b.prescribedDate) return new Date(b.prescribedDate);
          if (b.startDate) return new Date(b.startDate);
          if (b.createdAt) return new Date(b.createdAt);
          return new Date(0); // Fallback to epoch if no date found
        };
        const dateA = getDateA();
        const dateB = getDateB();
        return dateB.getTime() - dateA.getTime();
      })[0]

      // Get date with fallbacks
      const getMedDate = () => {
        if (mostRecentMed.orderedDate?.toDate) return mostRecentMed.orderedDate.toDate();
        if (mostRecentMed.dateActivated?.toDate) return mostRecentMed.dateActivated.toDate();
        if (mostRecentMed.prescribedDate?.toDate) return mostRecentMed.prescribedDate.toDate();
        if (mostRecentMed.startDate?.toDate) return mostRecentMed.startDate.toDate();
        if (mostRecentMed.createdAt?.toDate) return mostRecentMed.createdAt.toDate();
        if (mostRecentMed.orderedDate) return new Date(mostRecentMed.orderedDate);
        if (mostRecentMed.dateActivated) return new Date(mostRecentMed.dateActivated);
        if (mostRecentMed.prescribedDate) return new Date(mostRecentMed.prescribedDate);
        if (mostRecentMed.startDate) return new Date(mostRecentMed.startDate);
        if (mostRecentMed.createdAt) return new Date(mostRecentMed.createdAt);
        return new Date(); // Fallback to current date if no date found
      };

      const medDate = getMedDate();
      const medDescription = mostRecentMed.drugName || mostRecentMed.display || 'Medication';
      const isPending = mostRecentMed.status === 'pending';

      // Only add if date is valid
      if (medDate && !isNaN(medDate.getTime())) {
        activities.push({
          id: 2,
          type: "medication",
          title: isPending ? "Medication ordered" : "Medication prescribed",
          description: medDescription,
          time: formatRelativeTime(medDate.toISOString()),
          date: medDate,
          icon: Pill,
          color: isPending ? "amber" : "emerald"
        })
      }
    }

    // Add most recent lab test
    if (patientData.labTests && patientData.labTests.length > 0) {
      const mostRecentLab = patientData.labTests.sort((a: any, b: any) => {
        // Try multiple date fields with fallbacks
        const getDateA = () => {
          if (a.dateActivated?.toDate) return a.dateActivated.toDate();
          if (a.observationDate?.toDate) return a.observationDate.toDate();
          if (a.obsDatetime?.toDate) return a.obsDatetime.toDate();
          if (a.createdAt?.toDate) return a.createdAt.toDate();
          if (a.dateActivated) return new Date(a.dateActivated);
          if (a.observationDate) return new Date(a.observationDate);
          if (a.obsDatetime) return new Date(a.obsDatetime);
          if (a.createdAt) return new Date(a.createdAt);
          return new Date(0); // Fallback to epoch if no date found
        };
        const getDateB = () => {
          if (b.dateActivated?.toDate) return b.dateActivated.toDate();
          if (b.observationDate?.toDate) return b.observationDate.toDate();
          if (b.obsDatetime?.toDate) return b.obsDatetime.toDate();
          if (b.createdAt?.toDate) return b.createdAt.toDate();
          if (b.dateActivated) return new Date(b.dateActivated);
          if (b.observationDate) return new Date(b.observationDate);
          if (b.obsDatetime) return new Date(b.obsDatetime);
          if (b.createdAt) return new Date(b.createdAt);
          return new Date(0); // Fallback to epoch if no date found
        };
        const dateA = getDateA();
        const dateB = getDateB();
        return dateB.getTime() - dateA.getTime();
      })[0]

      // Get date with fallbacks
      const getLabDate = () => {
        if (mostRecentLab.dateActivated?.toDate) return mostRecentLab.dateActivated.toDate();
        if (mostRecentLab.observationDate?.toDate) return mostRecentLab.observationDate.toDate();
        if (mostRecentLab.obsDatetime?.toDate) return mostRecentLab.obsDatetime.toDate();
        if (mostRecentLab.createdAt?.toDate) return mostRecentLab.createdAt.toDate();
        if (mostRecentLab.dateActivated) return new Date(mostRecentLab.dateActivated);
        if (mostRecentLab.observationDate) return new Date(mostRecentLab.observationDate);
        if (mostRecentLab.obsDatetime) return new Date(mostRecentLab.obsDatetime);
        if (mostRecentLab.createdAt) return new Date(mostRecentLab.createdAt);
        return new Date(); // Fallback to current date if no date found
      };
      
      const labDate = getLabDate();
      const labDescription = mostRecentLab.conceptName || mostRecentLab.display || 'Lab test';

      // Only add if date is valid
      if (labDate && !isNaN(labDate.getTime())) {
        activities.push({
          id: 3,
          type: "lab",
          title: "Lab test ordered",
          description: labDescription,
          time: formatRelativeTime(labDate.toISOString()),
          date: labDate,
          icon: TestTube,
          color: "purple"
        })
      }
    }

    // Sort activities by date (most recent first)
    return activities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 3) // Return only the 3 most recent activities
  }

  const formatRelativeTime = (dateString: string) => {
    try {
      const now = new Date()
      const date = new Date(dateString)
      
      if (isNaN(date.getTime())) {
        return "Invalid date"
      }
      
      const diffInMs = now.getTime() - date.getTime()
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
      const diffInDays = Math.floor(diffInHours / 24)

      if (diffInHours < 1) {
        return "Just now"
      } else if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
      } else if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
      } else {
        return formatDate(dateString)
      }
    } catch (error) {
      console.error("Error formatting relative time:", dateString, error)
      return "Invalid date"
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return "Invalid date"
      }
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch (error) {
      console.error("Error formatting date:", dateString, error)
      return "Invalid date"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-100 border-t-blue-600"></div>
          <Shield className="absolute inset-0 m-auto h-5 w-5 text-olive-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Loading your health data</h2>
        <p className="text-gray-600 text-center max-w-sm text-sm">
          Please wait while we securely retrieve your information
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-red-200 rounded-xl shadow-sm">
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Data</h2>
            <p className="text-gray-600 mb-6 text-sm">{error}</p>
            <button
              onClick={loadPatientData}
              className="w-full bg-olive-500 hover:bg-olive-600 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center text-sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!patientData) {
    return null
  }

  return (
    <div className="min-h-screen bg-cream-100">

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Modern Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 bg-olive-500 rounded-xl flex items-center justify-center">
                  <Heart className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-gray-900">Patient Portal</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Main Menu Label */}
            <div className="px-5 pt-6 pb-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Main Menu</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 space-y-1">
              {[
                { id: "overview", label: "Overview", icon: Award },
                { id: "vitals", label: "Vital Signs", icon: Heart },
                { id: "medications", label: "Medications", icon: Pill },
                { id: "labs", label: "Lab Tests", icon: TestTube },
                { id: "notes", label: "Clinical Notes", icon: Stethoscope },
                { id: "attachments", label: "Attachments", icon: FileText },
                { id: "visits", label: "Visit History", icon: Calendar },
              ]
              .filter((item) => {
                // Role-based tab visibility
                if (userRole === 'nurse') {
                  // Nurses only see Vital Signs tab
                  return item.id === 'vitals';
                }
                // Admin and Doctor see all tabs
                return true;
              })
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-olive-500 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Patient Info Card */}
            <div className="flex-shrink-0 p-4">
              <div className="relative bg-olive-500 rounded-2xl p-4 text-white overflow-hidden">
                {/* Decorative curves */}
                <svg className="absolute right-0 top-0 h-full w-24 opacity-20" viewBox="0 0 100 150" fill="none">
                  <circle cx="120" cy="75" r="80" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <circle cx="140" cy="75" r="60" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>

                {/* Patient Avatar */}
                <div className="relative mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-lg flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                </div>

                {/* Patient Info */}
                <p className="text-sm font-medium leading-relaxed mb-1">
                  {getPatientName(patientData.patient)}
                </p>
                <p className="text-xs text-white/70 mb-4">
                  ID: {getPatientId(patientData.patient)}
                </p>

                {/* Action Button */}
                <button
                  onClick={handleLogout}
                  className={`w-full font-medium text-sm py-2 px-4 rounded-xl transition-colors ${
                    isAdminView
                      ? 'bg-white text-olive-700 hover:bg-white/90'
                      : 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
                  }`}
                >
                  {isAdminView ? (
                    <span className="flex items-center justify-center">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Admin
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 min-h-screen md:ml-0 transition-all duration-300 ${askHopeOpen ? 'mr-[440px]' : ''}`}>
          {/* Header */}
          <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Left: Mobile menu + Patient Info */}
                <div className="flex items-center space-x-4 flex-1">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <Menu className="h-5 w-5" />
                  </button>

                  {/* Search Bar */}
                  {isAdminView ? (
                    <div className="relative flex-1 max-w-md" ref={searchRef}>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search patients..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:bg-white transition-all"
                      />
                      {searching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-olive-600 animate-spin" />
                      )}

                      {/* Search Results Dropdown */}
                      {showSearchResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg max-h-96 overflow-y-auto z-50">
                          {searchResults.map((patient) => (
                            <button
                              key={patient.uuid}
                              onClick={() => handlePatientSelect(patient.uuid)}
                              className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                            >
                              <div className="h-10 w-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {getPatientName(patient)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  ID: {getPatientId(patient)} • {getPatientGender(patient).toUpperCase()}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* No Results */}
                      {showSearchResults && searchResults.length === 0 && !searching && searchQuery.trim() && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg p-4 z-50">
                          <p className="text-sm text-gray-600 text-center">No patients found</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="hidden md:flex items-center space-x-3">
                      <div className="h-9 w-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{getPatientName(patientData?.patient)}</p>
                        <p className="text-xs text-gray-500">Patient ID: {getPatientId(patientData?.patient)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Actions + Quick Links */}
                <div className="flex items-center space-x-2">
                  {/* AI Status Indicator */}
                  <div className="hidden md:block mr-2">
                    {aiStatus.loading && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full">
                        <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                        <span className="text-xs font-medium text-blue-700">{aiStatus.progress}</span>
                      </div>
                    )}
                    {aiStatus.loaded && !aiStatus.loading && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-full">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs font-medium text-green-700">AI Ready</span>
                      </div>
                    )}
                    {aiStatus.error && !aiStatus.loading && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-full">
                        <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                        <span className="text-xs font-medium text-red-700">AI Error</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setShowPatientDetailsModal(true)}
                    className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                    title="View Details"
                  >
                    <User className="h-5 w-5" />
                  </button>
                  {isAdminView && (
                    <>
                      <button
                        onClick={() => setShowReferPatientModal(true)}
                        className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        title="Refer Patient"
                      >
                        <Send className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setShowFollowUpModal(true)}
                        className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        title="Schedule Follow Up"
                      >
                        <CalendarClock className="h-5 w-5" />
                      </button>
                    </>
                  )}

                  {/* User Avatar */}
                  <div className="ml-2">
                    <div className="h-9 w-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center ring-2 ring-white">
                      <span className="text-sm font-medium text-white">
                        {getPatientName(patientData?.patient)?.charAt(0) || 'P'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Page Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900">
                {activeTab === "overview" && "Health Overview"}
                {activeTab === "vitals" && "Vital Signs"}
                {activeTab === "medications" && "Medications"}
                {activeTab === "labs" && "Lab Tests"}
                {activeTab === "notes" && "Clinical Notes"}
                {activeTab === "attachments" && "Attachments"}
                {activeTab === "visits" && "Visit History"}
              </h1>
            </div>
          </div>

          <div className="px-6 pb-8">
            {/* Overview Content - Only show when overview tab is selected */}
            {activeTab === "overview" && (
              <>
                {/* Overview Header with Actions */}
                <div className="mb-8 flex items-start justify-between">
                  <div>
                    <p className="text-gray-600">Your complete health summary and recent activity</p>
                  </div>

                  {/* Add Visit & Add Order Buttons (Admin Only) */}
                  {isAdminView && (
                    <div className="flex items-center gap-3">
                      <div className="relative" ref={addVisitRef}>
                        <button
                          onClick={() => {
                            setShowAddVisitMenu(!showAddVisitMenu);
                            setShowAddOrderMenu(false); // Close the other menu
                          }}
                          className="flex items-center gap-2 bg-olive-500 hover:bg-olive-600 text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
                        >
                          <Plus className="h-4 w-4" />
                          Add Visit
                          <ChevronDown className={`h-4 w-4 transition-transform ${showAddVisitMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showAddVisitMenu && (
                          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                            <button
                              onClick={() => {
                                setShowVitalsForm(true);
                                setShowAddVisitMenu(false);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                            >
                              <Activity className="h-4 w-4 text-olive-600" />
                              <div>
                                <div className="font-medium text-sm">Record Vitals</div>
                                <div className="text-xs text-gray-500">Blood pressure, temperature, etc.</div>
                              </div>
                            </button>
                            <button
                              onClick={() => {
                                setShowConsultationForm(true);
                                setShowAddVisitMenu(false);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                            >
                              <Stethoscope className="h-4 w-4 text-green-600" />
                              <div>
                                <div className="font-medium text-sm">New Consultation</div>
                                <div className="text-xs text-gray-500">Complete consultation form</div>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="relative" ref={addOrderRef}>
                        <button
                          onClick={() => {
                            setShowAddOrderMenu(!showAddOrderMenu);
                            setShowAddVisitMenu(false); // Close the other menu
                          }}
                          className="flex items-center gap-2 bg-white border border-gray-100 text-gray-700 hover:bg-gray-50 font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
                        >
                          <Plus className="h-4 w-4" />
                          Add Order
                          <ChevronDown className={`h-4 w-4 transition-transform ${showAddOrderMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showAddOrderMenu && (
                          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                            <button
                              onClick={() => {
                                setOrderFormType('medication');
                                setShowOrderForm(true);
                                setShowAddOrderMenu(false);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                            >
                              <Pill className="h-4 w-4 text-olive-600" />
                              <div>
                                <div className="font-medium text-sm">Medication Order</div>
                                <div className="text-xs text-gray-500">Prescribe medication</div>
                              </div>
                            </button>
                            <button
                              onClick={() => {
                                setOrderFormType('lab');
                                setShowOrderForm(true);
                                setShowAddOrderMenu(false);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                            >
                              <TestTube className="h-4 w-4 text-green-600" />
                              <div>
                                <div className="font-medium text-sm">Lab Test Order</div>
                                <div className="text-xs text-gray-500">Order laboratory test</div>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* NCD Clinical Decision Support Alerts - Admin/Clinician View Only */}
                {isAdminView && patientData && (
                  <NCDAlerts
                    patientData={{
                      vitals: patientData.vitals,
                      medications: patientData.pharmacyOrders || patientData.medications,
                      labResults: patientData.labOrders || patientData.labTests,
                      diagnoses: patientData.diagnoses,
                      encounters: patientData.encounters,
                      allergies: patientData.allergies,
                    }}
                  />
                )}

                  {/* Health Score & Quick Stats */}
                  <div className={`grid gap-4 mb-8 ${askHopeOpen ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
                    {/* Total Records */}
                    <div className="bg-olive-500 rounded-xl shadow-sm p-5 relative overflow-hidden">
                      {/* Decorative curves */}
                      <svg className="absolute right-0 top-0 h-full w-20 opacity-20" viewBox="0 0 100 150" fill="none">
                        <circle cx="100" cy="75" r="60" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-white" />
                        <circle cx="110" cy="75" r="40" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-white" />
                      </svg>
                      <div className="relative flex items-center justify-between mb-3">
                        <div>
                          <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">Total Records</p>
                          <p className="text-2xl font-bold text-white tabular-nums mt-1">{getTotalRecords()}</p>
                        </div>
                        <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                          <Activity className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div className="relative flex items-center text-white/70 text-xs">
                        <FileText className="mr-1 h-3 w-3" />
                        <span>All health data combined</span>
                      </div>
                    </div>

                    {/* Active Medications */}
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Medications</p>
                          <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{(patientData.pharmacyOrders?.length || 0) + (patientData.medications?.length || 0)}</p>
                        </div>
                        <div className="h-10 w-10 bg-gray-100 rounded-xl flex items-center justify-center">
                          <Pill className="h-5 w-5 text-gray-700" />
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab("medications")}
                        className="text-gray-600 hover:text-gray-900 text-xs font-semibold uppercase tracking-wide"
                      >
                        View all →
                      </button>
                    </div>

                    {/* Pending Tests */}
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Pending Tests</p>
                          <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                            {patientData.labTests.filter(test => {
                              const status = test.status?.toLowerCase();
                              return !test.status || status === 'pending' || status === 'in-progress' || status === 'active';
                            }).length}
                          </p>
                        </div>
                        <div className="h-10 w-10 bg-amber-50 flex items-center justify-center border border-amber-200">
                          <TestTube className="h-5 w-5 text-amber-700" />
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab("labs")}
                        className="text-gray-600 hover:text-gray-900 text-xs font-semibold uppercase tracking-wide"
                      >
                        View results →
                      </button>
                    </div>

                    {/* Last Visit */}
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Last Visit</p>
                          <p className="text-lg font-bold text-gray-900 mt-1">
                            {(() => {
                              const lastVisit = getNextAppointment();
                              if (!lastVisit) return 'No visits yet';
                              // Handle Firestore Timestamp or Date object
                              let dateStr: string;
                              if (lastVisit?.toDate) {
                                dateStr = lastVisit.toDate().toISOString();
                              } else if (lastVisit instanceof Date) {
                                dateStr = lastVisit.toISOString();
                              } else if (typeof lastVisit === 'string') {
                                dateStr = lastVisit;
                              } else {
                                return 'Invalid date';
                              }
                              return formatDate(dateStr);
                            })()}
                          </p>
                        </div>
                        <div className="h-10 w-10 bg-gray-100 rounded-xl flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-gray-700" />
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab("visits")}
                        className="text-gray-600 hover:text-gray-900 text-xs font-semibold uppercase tracking-wide"
                      >
                        View History →
                      </button>
                    </div>
                  </div>

                {/* Recent Activity & Upcoming Appointments */}
                <div className={`grid gap-8 mb-8 ${askHopeOpen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                  {/* Recent Activity */}
                  <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-100">
                          <Activity className="h-4 w-4 text-gray-700" />
                        </div>
                        <h2 className="text-base font-semibold text-gray-800 uppercase tracking-wide">Recent Activity</h2>
                      </div>
                      <button 
                        onClick={() => setActiveTab("vitals")}
                        className="text-xs text-gray-600 hover:text-gray-900 font-semibold uppercase tracking-wide"
                      >
                        View all →
                      </button>
                    </div>

                    <div className="space-y-2">
                      {getRecentActivity().map((activity) => (
                        <div key={activity.id} className="flex items-start space-x-3 p-3 border border-gray-100 bg-white hover:bg-gray-50 rounded-xl">
                          <div className={`h-7 w-7 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-100`}>
                            <activity.icon className={`h-3.5 w-3.5 text-gray-700`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{activity.title}</p>
                            <p className="text-xs text-gray-600 font-mono">{activity.time}</p>
                            {activity.description && (
                              <p className="text-xs text-gray-600 mt-1">{activity.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Upcoming Appointments */}
                  <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-100">
                          <Calendar className="h-4 w-4 text-gray-700" />
                        </div>
                        <h2 className="text-base font-semibold text-gray-800 uppercase tracking-wide">Upcoming Appointments</h2>
                      </div>
                      <button className="text-xs text-gray-600 hover:text-gray-900 font-semibold uppercase tracking-wide">
                        Schedule →
                      </button>
                    </div>

                    <div className="space-y-2">
                      {patientData.appointments && patientData.appointments.length > 0 ? (
                        patientData.appointments.map((appointment) => (
                          <div key={appointment.uuid} className="border border-gray-100 bg-white rounded-xl shadow-sm p-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <div className="h-7 w-7 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-100">
                                  <Calendar className="h-3.5 w-3.5 text-gray-700" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">
                                    {appointment.service?.name || 'Appointment'}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    {appointment.providers?.[0]?.name || 'Healthcare Provider'}
                                  </p>
                                </div>
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold border ${
                                appointment.status === 'SCHEDULED' || !appointment.status
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : getStatusVariant(appointment.status)
                              }`}>
                                {appointment.status || 'SCHEDULED'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-600 mt-2 pt-2 border-t border-gray-100">
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-3 w-3 text-gray-500" />
                                <span className="font-mono">
                                  {(() => {
                                    const startDate = new Date(appointment.startDateTime);
                                    const endDate = new Date(appointment.endDateTime);
                                    
                                    // Convert UTC to local time for display
                                    const startLocal = new Date(appointment.startDateTime);
                                    const endLocal = new Date(appointment.endDateTime);
                                    
                                    // Check if it's a very short duration at midnight (likely placeholder)
                                    const durationMinutes = (endLocal.getTime() - startLocal.getTime()) / (1000 * 60);
                                    const startHours = startLocal.getHours();
                                    const startMinutes = startLocal.getMinutes();
                                    
                                    if (startHours === 0 && startMinutes === 0 && durationMinutes < 5) {
                                      return `${startDate.toLocaleDateString()} (Time TBD)`;
                                    }
                                    
                                    return `${startDate.toLocaleDateString()} ${startLocal.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${endLocal.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                                  })()}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <MapPin className="h-3 w-3 text-gray-500" />
                                <span>{appointment.location?.name || 'Main Clinic'}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-center p-8 border border-gray-100 bg-gray-50">
                          <div className="text-center">
                            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-900 mb-1">No upcoming appointments</p>
                            <p className="text-xs text-gray-500">Your scheduled appointments will appear here</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Active Conditions & Allergies */}
                {((patientData.diagnoses && patientData.diagnoses.length > 0) || (patientData.allergies && patientData.allergies.length > 0)) && (
                  <div className={`grid gap-8 mb-8 ${askHopeOpen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                    {/* Diagnoses/Conditions */}
                    {patientData.diagnoses && patientData.diagnoses.length > 0 && (
                      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100">
                              <FileText className="h-4 w-4 text-amber-700" />
                            </div>
                            <h2 className="text-base font-semibold text-gray-800 uppercase tracking-wide">Active Conditions</h2>
                          </div>
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                            {patientData.diagnoses.length} {patientData.diagnoses.length === 1 ? 'condition' : 'conditions'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {patientData.diagnoses.map((diagnosis: any, index: number) => (
                            <div key={diagnosis.id || index} className="flex items-start space-x-3 p-3 border border-gray-100 bg-white hover:bg-gray-50 rounded-xl">
                              <div className="h-7 w-7 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100 flex-shrink-0">
                                <span className="text-xs font-bold text-amber-700">{index + 1}</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">
                                  {diagnosis.conditionText || diagnosis.condition_text || 'Unknown condition'}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {diagnosis.certainty && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                      diagnosis.certainty === 'confirmed' ? 'bg-green-100 text-green-700' :
                                      diagnosis.certainty === 'provisional' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {diagnosis.certainty}
                                    </span>
                                  )}
                                  {(diagnosis.diagnosedDate || diagnosis.diagnosed_date) && (
                                    <span className="text-xs text-gray-500">
                                      {formatDate(diagnosis.diagnosedDate || diagnosis.diagnosed_date)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Allergies */}
                    {patientData.allergies && patientData.allergies.length > 0 && (
                      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 bg-rose-50 rounded-xl flex items-center justify-center border border-rose-100">
                              <AlertCircle className="h-4 w-4 text-rose-600" />
                            </div>
                            <h2 className="text-base font-semibold text-gray-800 uppercase tracking-wide">Allergies</h2>
                          </div>
                          <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-full font-medium">
                            {patientData.allergies.length} {patientData.allergies.length === 1 ? 'allergy' : 'allergies'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {patientData.allergies.map((allergy: any, index: number) => (
                            <div key={allergy.id || index} className="flex items-start space-x-3 p-3 border border-rose-100 bg-rose-50/30 hover:bg-rose-50/50 rounded-xl">
                              <div className="h-7 w-7 bg-rose-100 rounded-xl flex items-center justify-center border border-rose-200 flex-shrink-0">
                                <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">
                                  {allergy.allergen || 'Unknown allergen'}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {allergy.criticality && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                      allergy.criticality === 'high' ? 'bg-rose-200 text-rose-800' :
                                      allergy.criticality === 'low' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {allergy.criticality === 'unable-to-assess' ? 'Unknown severity' : allergy.criticality}
                                    </span>
                                  )}
                                  {allergy.category && (
                                    <span className="text-xs text-gray-500 capitalize">{allergy.category}</span>
                                  )}
                                  {allergy.reaction && (
                                    <span className="text-xs text-gray-600">Reaction: {allergy.reaction}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Tab Content Sections */}
            <div className="space-y-8">

              {activeTab === "vitals" && (
                <>
                  {/* Page Title */}
                  <div className="mb-8">
                    {isAdminView && (
                      <div className="flex justify-end mb-4">
                        <button
                          onClick={() => setShowVitalsForm(true)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors text-sm shadow-sm"
                        >
                          <Plus className="h-4 w-4" />
                          Record Vitals
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Vital Signs by Date */}
                  {patientData.vitals.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6">
                      {(() => {
                        // Group vitals by date
                        const vitalsByDate = patientData.vitals.reduce((acc, vital) => {
                          // Get date with fallbacks and validation
                          const getVitalDate = () => {
                            if (vital.obsDatetime?.toDate) return vital.obsDatetime.toDate();
                            if (vital.observationDate?.toDate) return vital.observationDate.toDate();
                            if (vital.createdAt?.toDate) return vital.createdAt.toDate();
                            if (vital.obsDatetime) return new Date(vital.obsDatetime);
                            if (vital.observationDate) return new Date(vital.observationDate);
                            if (vital.createdAt) return new Date(vital.createdAt);
                            return new Date(); // Fallback to current date
                          };
                          const vitalDate = getVitalDate();
                          // Only group if date is valid
                          if (vitalDate && !isNaN(vitalDate.getTime())) {
                            const date = formatDate(vitalDate.toISOString());
                            if (!acc[date]) {
                              acc[date] = [];
                            }
                            acc[date].push(vital);
                          } else {
                            // Group invalid dates under "Unknown Date"
                            if (!acc['Unknown Date']) {
                              acc['Unknown Date'] = [];
                            }
                            acc['Unknown Date'].push(vital);
                          }
                          return acc;
                        }, {} as Record<string, typeof patientData.vitals>);

                        // Sort dates (most recent first)
                        const sortedDates = Object.keys(vitalsByDate).sort((a, b) => 
                          new Date(b).getTime() - new Date(a).getTime()
                        );

                        return sortedDates.map((date, index) => {
                          const dateVitals = vitalsByDate[date];
                          const firstVital = dateVitals[0];
                          const vitalDate = firstVital.obsDatetime?.toDate ? firstVital.obsDatetime.toDate() : new Date(firstVital.obsDatetime || firstVital.observationDate);
                          
                          return (
                            <div key={date} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <Calendar className="h-5 w-5 text-gray-600" />
                                    <div>
                                      <h3 className="text-base font-semibold text-gray-800">{date}</h3>
                                      <p className="text-xs text-gray-600">{dateVitals.length} vital sign{dateVitals.length > 1 ? 's' : ''} recorded</p>
                                    </div>
                                  </div>
                                  <span className="text-xs text-gray-600 font-medium">
                                    {vitalDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                </div>
                              </div>

                              <div className="p-6">
                                <div className="border border-gray-100 bg-white">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100 border-b-2 border-gray-200">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Vital Sign</th>
                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wide">Value</th>
                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wide">Normal Range</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(() => {
                                        // Group blood pressure readings together
                                        const groupedVitals: any[] = [];
                                        const bpSystolic = dateVitals.find((v: any) => 
                                          v.conceptCode === 'systolic_bp' || 
                                          v.conceptDisplay?.toLowerCase().includes('systolic')
                                        );
                                        const bpDiastolic = dateVitals.find((v: any) => 
                                          v.conceptCode === 'diastolic_bp' || 
                                          v.conceptDisplay?.toLowerCase().includes('diastolic')
                                        );
                                        
                                        // Add BP as combined entry if both exist
                                        if (bpSystolic && bpDiastolic) {
                                          const systolicValue = typeof bpSystolic.value === "object" ? bpSystolic.value.display : bpSystolic.value;
                                          const diastolicValue = typeof bpDiastolic.value === "object" ? bpDiastolic.value.display : bpDiastolic.value;
                                          groupedVitals.push({
                                            ...bpSystolic,
                                            combined: true,
                                            displayValue: `${systolicValue}/${diastolicValue}`,
                                            unit: 'mmHg',
                                            referenceRange: '90-140/60-90'
                                          });
                                        }
                                        
                                        // Add other vitals (excluding individual BP readings)
                                        dateVitals.forEach((vital: any) => {
                                          const isBP = vital.conceptCode === 'systolic_bp' || 
                                                     vital.conceptCode === 'diastolic_bp' ||
                                                     vital.conceptDisplay?.toLowerCase().includes('systolic') ||
                                                     vital.conceptDisplay?.toLowerCase().includes('diastolic');
                                          if (!isBP) {
                                            const vitalName = vital.conceptDisplay || vital.conceptName || vital.concept?.display || 'Vital Sign';
                                            const vitalValue = (vital.value != null && typeof vital.value === "object") ? vital.value.display : (vital.value ?? '');
                                            const vitalUnit = vital.unit || '';
                                            
                                            // Reference ranges for common vitals
                                            let referenceRange = '';
                                            const code = vital.conceptCode?.toLowerCase() || vitalName.toLowerCase();
                                            if (code.includes('temperature') || code.includes('temp')) {
                                              referenceRange = '36.1-37.2°C';
                                            } else if (code.includes('pulse') || code.includes('heart rate')) {
                                              referenceRange = '60-100 bpm';
                                            } else if (code.includes('respiratory') || code.includes('resp rate')) {
                                              referenceRange = '12-20 /min';
                                            } else if (code.includes('oxygen') || code.includes('spo2') || code.includes('o2 sat')) {
                                              referenceRange = '95-100%';
                                            } else if (code.includes('weight')) {
                                              referenceRange = 'Varies by age/height';
                                            } else if (code.includes('height')) {
                                              referenceRange = 'Varies by age';
                                            } else if (code.includes('fbs') || code.includes('fasting')) {
                                              referenceRange = '70-100 mg/dL';
                                            } else if (code.includes('rbs') || code.includes('random')) {
                                              referenceRange = '<140 mg/dL';
                                            }
                                            
                                            groupedVitals.push({
                                              ...vital,
                                              displayValue: `${vitalValue} ${vitalUnit}`,
                                              referenceRange
                                            });
                                          }
                                        });
                                        
                                        return groupedVitals.map((vital: any) => {
                                          const vitalName = vital.combined ? 'Blood Pressure' : 
                                                            (vital.conceptDisplay || vital.conceptName || vital.concept?.display || 'Vital Sign');
                                          
                                          // Check if value is abnormal (basic checks)
                                          const isAbnormal = (() => {
                                            if (vital.combined) {
                                              const [systolic, diastolic] = vital.displayValue.split('/').map(Number);
                                              return systolic > 140 || systolic < 90 || diastolic > 90 || diastolic < 60;
                                            }
                                            const code = vital.conceptCode?.toLowerCase() || vitalName.toLowerCase();
                                            const numValue = parseFloat(vital.displayValue);
                                            if (isNaN(numValue)) return false;
                                            
                                            if (code.includes('temperature')) {
                                              return numValue > 37.5 || numValue < 35;
                                            } else if (code.includes('pulse')) {
                                              return numValue > 100 || numValue < 60;
                                            } else if (code.includes('respiratory')) {
                                              return numValue > 20 || numValue < 12;
                                            } else if (code.includes('oxygen')) {
                                              return numValue < 95;
                                            } else if (code.includes('fbs')) {
                                              return numValue > 126;
                                            } else if (code.includes('rbs')) {
                                              return numValue > 200;
                                            }
                                            return false;
                                          })();
                                          
                                          return (
                                            <tr key={vital.uuid || vital.id} className={`${isAbnormal ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''}`}>
                                              <td className="px-4 py-2.5 text-sm font-medium text-gray-800">
                                                {vitalName}
                                              </td>
                                              <td className="px-4 py-2.5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                  <span className={`text-sm font-semibold tabular-nums ${isAbnormal ? 'text-amber-700' : 'text-gray-900'}`}>
                                                    {vital.displayValue || ((vital.value != null && typeof vital.value === "object") ? vital.value.display : (vital.value ?? '')) + ' ' + (vital.unit || '')}
                                                  </span>
                                                  {isAbnormal && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                                                      ABN
                                                    </span>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="px-4 py-2.5 text-right text-xs text-gray-600 font-mono">
                                                {vital.referenceRange || '—'}
                                              </td>
                                            </tr>
                                          );
                                        });
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-8 text-center">
                      <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-900 mb-1">No vital signs recorded</p>
                      <p className="text-xs text-gray-500">Vital signs will appear here when recorded by healthcare providers</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === "medications" && (
                <>
                  {isAdminView && (
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => {
                          setOrderFormType('medication');
                          setShowOrderForm(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors text-sm shadow-sm"
                      >
                        <Plus className="h-4 w-4" />
                        Add Medication
                      </button>
                    </div>
                  )}
                  
                  {(() => {
                    // Combine pharmacy orders (pending, dispensed) with medications (legacy data)
                    // pharmacyOrders is the primary source from Firestore pharmacyOrders collection
                    // medications comes from observations (legacy completed prescriptions)

                    // Map pharmacy orders - these include pending, active, and dispensed orders
                    const pharmacyOrderItems = (patientData.pharmacyOrders || []).map((rx: any) => ({
                      ...rx,
                      // Normalize field names for consistent display
                      drugName: rx.drugName || rx.medicationName || rx.display,
                      status: rx.status || 'pending',
                      // Use dispensedAt for dispensed, orderedDate/createdAt for pending
                      _sortDate: rx.status === 'dispensed'
                        ? (rx.dispensedAt?.toDate?.() || (rx.dispensedAt ? new Date(rx.dispensedAt) : null) ||
                           rx.updatedAt?.toDate?.() || (rx.updatedAt ? new Date(rx.updatedAt) : new Date()))
                        : (rx.orderedDate?.toDate?.() || (rx.orderedDate ? new Date(rx.orderedDate) : null) ||
                           rx.createdAt?.toDate?.() || (rx.createdAt ? new Date(rx.createdAt) : new Date())),
                      _isFromPharmacyOrders: true,
                    }));

                    // Map medications (legacy) - only include if there are no pharmacy orders
                    const medicationItems = pharmacyOrderItems.length === 0
                      ? (patientData.medications || []).map((med: any) => ({
                          ...med,
                          status: med.status || 'active',
                          _sortDate: med.prescribedDate?.toDate?.() || (med.prescribedDate ? new Date(med.prescribedDate) : null) ||
                                     med.startDate?.toDate?.() || (med.startDate ? new Date(med.startDate) : null) ||
                                     med.createdAt?.toDate?.() || (med.createdAt ? new Date(med.createdAt) : new Date()),
                          _isFromPharmacyOrders: false,
                        }))
                      : [];

                    // Combine both sources
                    const allMedItems = [...pharmacyOrderItems, ...medicationItems];

                    return allMedItems.length > 0 ? (
                    <div className="space-y-6">
                      {(() => {
                        // Group medications by date
                        const medsByDate = allMedItems.reduce((acc: any, med: any) => {
                          const getMedDate = () => {
                            // First try the pre-computed _sortDate
                            if (med._sortDate) return med._sortDate;
                            // Fallbacks for any edge cases
                            if (med.prescribedDate?.toDate) return med.prescribedDate.toDate();
                            if (med.startDate?.toDate) return med.startDate.toDate();
                            if (med.dateActivated?.toDate) return med.dateActivated.toDate();
                            if (med.createdAt?.toDate) return med.createdAt.toDate();
                            if (med.prescribedDate) return new Date(med.prescribedDate);
                            if (med.startDate) return new Date(med.startDate);
                            if (med.dateActivated) return new Date(med.dateActivated);
                            if (med.createdAt) return new Date(med.createdAt);
                            return new Date();
                          };
                          const medDate = getMedDate();
                          if (medDate && !isNaN(medDate.getTime())) {
                            const date = formatDate(medDate.toISOString());
                            if (!acc[date]) acc[date] = [];
                            acc[date].push(med);
                          } else {
                            if (!acc['Unknown Date']) acc['Unknown Date'] = [];
                            acc['Unknown Date'].push(med);
                          }
                          return acc;
                        }, {} as Record<string, any[]>);

                        const sortedDates = Object.keys(medsByDate).sort((a, b) => 
                          new Date(b).getTime() - new Date(a).getTime()
                        );

                        return sortedDates.map((date) => {
                          const dateMeds = medsByDate[date];
                          const firstMed = dateMeds[0];
                          const getMedDate = () => {
                            if (firstMed.prescribedDate?.toDate) return firstMed.prescribedDate.toDate();
                            if (firstMed.startDate?.toDate) return firstMed.startDate.toDate();
                            if (firstMed.dateActivated?.toDate) return firstMed.dateActivated.toDate();
                            if (firstMed.createdAt?.toDate) return firstMed.createdAt.toDate();
                            if (firstMed.prescribedDate) return new Date(firstMed.prescribedDate);
                            if (firstMed.startDate) return new Date(firstMed.startDate);
                            if (firstMed.dateActivated) return new Date(firstMed.dateActivated);
                            if (firstMed.createdAt) return new Date(firstMed.createdAt);
                            return new Date();
                          };
                          const medDate = getMedDate();
                          
                          return (
                            <div key={date} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <Calendar className="h-5 w-5 text-gray-600" />
                                    <div>
                                      <h3 className="text-base font-semibold text-gray-800">{date}</h3>
                                      <p className="text-xs text-gray-600">{dateMeds.length} medication{dateMeds.length > 1 ? 's' : ''} prescribed</p>
                                    </div>
                                  </div>
                                  {medDate && !isNaN(medDate.getTime()) && (
                                    <span className="text-xs text-gray-600 font-medium">
                                      {medDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="p-6">
                                <div className="border border-gray-100 bg-white">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100 border-b-2 border-gray-200">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Medication</th>
                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Dosage</th>
                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Frequency</th>
                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wide">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {dateMeds.map((med: any) => {
                                        const medName = med.drugName || med.medicationName || med.display || 'Medication';
                                        const isPending = med.status?.toLowerCase() === 'pending';
                                        return (
                                          <tr 
                                            key={med.id || med.uuid} 
                                            onClick={() => setSelectedMedication(med)}
                                            className={`${isPending ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''} hover:bg-gray-50 cursor-pointer`}
                                          >
                                            <td className="px-4 py-2.5 text-sm font-medium text-gray-800">
                                              {medName}
                                            </td>
                                            <td className="px-4 py-2.5 text-sm text-gray-700">
                                              {med.dosage ? `${med.dosage} ${med.dosageUnit || ''}` : '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-sm text-gray-700">
                                              {med.frequency || '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                              <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-semibold ${
                                                isPending 
                                                  ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                              } whitespace-nowrap`}>
                                                {med.status || (isPending ? 'Pending' : 'Active')}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-8 text-center">
                      <Pill className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-900 mb-1">No medications prescribed</p>
                      <p className="text-xs text-gray-500">Current and past medications will appear here when prescribed</p>
                    </div>
                  );
                  })()}
                </>
              )}

              {activeTab === "labs" && (
                <>
                  {isAdminView && (
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => {
                          setOrderFormType('lab');
                          setShowOrderForm(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors text-sm shadow-sm"
                      >
                        <Plus className="h-4 w-4" />
                        Order Lab Test
                      </button>
                    </div>
                  )}
                  
                  {/* Lab Tests by Date Accordion */}
                  {(() => {
                    // Combine labOrders (pending, in-progress, completed) with labTests (legacy completed results)
                    // labOrders is the primary source from Firestore orders collection
                    // labTests comes from observations (only completed results with values)

                    // Map labOrders - these include pending, in-progress, and completed orders
                    const labOrderItems = (patientData.labOrders || []).map((order: any) => ({
                      ...order,
                      // Normalize field names for consistent display
                      conceptName: order.testName || order.testType || order.conceptName,
                      value: order.result || order.value,
                      status: order.status || 'pending',
                      // Use orderedDate or completedAt based on status
                      _sortDate: order.status === 'completed'
                        ? (order.completedAt?.toDate?.() || (order.completedAt ? new Date(order.completedAt) : null) ||
                           order.updatedAt?.toDate?.() || (order.updatedAt ? new Date(order.updatedAt) : new Date()))
                        : (order.orderedDate?.toDate?.() || (order.orderedDate ? new Date(order.orderedDate) : null) ||
                           order.createdAt?.toDate?.() || (order.createdAt ? new Date(order.createdAt) : new Date())),
                      _isFromLabOrders: true,
                    }));

                    // Map labTests (from observations) - these are legacy completed results
                    // Only include if there are no labOrders (to avoid duplicates)
                    const labTestItems = labOrderItems.length === 0
                      ? (patientData.labTests || []).map((test: any) => ({
                          ...test,
                          status: test.status || 'completed',
                          _sortDate: test.observationDate?.toDate?.() || (test.observationDate ? new Date(test.observationDate) : null) ||
                                     test.obsDatetime?.toDate?.() || (test.obsDatetime ? new Date(test.obsDatetime) : null) ||
                                     test.createdAt?.toDate?.() || (test.createdAt ? new Date(test.createdAt) : new Date()),
                          _isFromLabOrders: false,
                        }))
                      : [];

                    // Combine both sources
                    const allLabItems = [...labOrderItems, ...labTestItems];

                    return allLabItems.length > 0 ? (
                    <div className="space-y-4">
                      {(() => {
                        // Group lab items by date
                        const testsByDate = allLabItems.reduce((acc: any, test: any) => {
                          // Get date with fallbacks and validation
                          const getTestDate = () => {
                            // First try the pre-computed _sortDate
                            if (test._sortDate) return test._sortDate;
                            // Fallbacks for any edge cases
                            if (test.orderedDate?.toDate) return test.orderedDate.toDate();
                            if (test.observationDate?.toDate) return test.observationDate.toDate();
                            if (test.obsDatetime?.toDate) return test.obsDatetime.toDate();
                            if (test.dateActivated?.toDate) return test.dateActivated.toDate();
                            if (test.createdAt?.toDate) return test.createdAt.toDate();
                            if (test.orderedDate) return new Date(test.orderedDate);
                            if (test.observationDate) return new Date(test.observationDate);
                            if (test.obsDatetime) return new Date(test.obsDatetime);
                            if (test.dateActivated) return new Date(test.dateActivated);
                            if (test.createdAt) return new Date(test.createdAt);
                            return new Date(); // Fallback to current date
                          };
                          const testDate = getTestDate();
                          // Only group if date is valid
                          if (testDate && !isNaN(testDate.getTime())) {
                            const date = formatDate(testDate.toISOString());
                            if (!acc[date]) {
                              acc[date] = [];
                            }
                            acc[date].push(test);
                          } else {
                            // Group invalid dates under "Unknown Date"
                            if (!acc['Unknown Date']) {
                              acc['Unknown Date'] = [];
                            }
                            acc['Unknown Date'].push(test);
                          }
                          return acc;
                        }, {} as Record<string, any[]>);

                        // Sort dates (most recent first)
                        const sortedDates = Object.keys(testsByDate).sort((a, b) => 
                          new Date(b).getTime() - new Date(a).getTime()
                        );

                        return sortedDates.map((date) => {
                          const dateTests = testsByDate[date];
                          const firstTest = dateTests[0];
                          const getTestDate = () => {
                            if (firstTest.observationDate?.toDate) return firstTest.observationDate.toDate();
                            if (firstTest.obsDatetime?.toDate) return firstTest.obsDatetime.toDate();
                            if (firstTest.dateActivated?.toDate) return firstTest.dateActivated.toDate();
                            if (firstTest.createdAt?.toDate) return firstTest.createdAt.toDate();
                            if (firstTest.observationDate) return new Date(firstTest.observationDate);
                            if (firstTest.obsDatetime) return new Date(firstTest.obsDatetime);
                            if (firstTest.dateActivated) return new Date(firstTest.dateActivated);
                            if (firstTest.createdAt) return new Date(firstTest.createdAt);
                            return new Date();
                          };
                          const testDate = getTestDate();
                          
                          return (
                            <div key={date} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <Calendar className="h-5 w-5 text-gray-600" />
                                    <div>
                                      <h3 className="text-base font-semibold text-gray-800">{date}</h3>
                                      <p className="text-xs text-gray-600">{dateTests.length} lab test{dateTests.length > 1 ? 's' : ''} ordered</p>
                                    </div>
                                  </div>
                                  {testDate && !isNaN(testDate.getTime()) && (
                                    <span className="text-xs text-gray-600 font-medium">
                                      {testDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="p-6">
                                <div className="border border-gray-100 bg-white">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100 border-b-2 border-gray-200">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Test</th>
                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wide">Result</th>
                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wide">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {dateTests.map((test: any) => {
                                        const testName = test.conceptName || test.conceptDisplay || test.display || 'Lab Test';
                                        const testValue = typeof test.value === "object" ? test.value.display : test.value;
                                        const isPending = test.status?.toLowerCase() === 'pending';
                                        return (
                                          <tr 
                                            key={test.id || test.uuid} 
                                            onClick={() => setSelectedLabTest(test)}
                                            className={`${isPending ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''} hover:bg-gray-50 cursor-pointer`}
                                          >
                                            <td className="px-4 py-2.5 text-sm font-medium text-gray-800">
                                              {testName}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-gray-900">
                                              {testValue || '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                              <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-semibold ${
                                                isPending 
                                                  ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                                  : 'bg-purple-100 text-purple-800 border border-purple-300'
                                              } whitespace-nowrap`}>
                                                {test.status || (isPending ? 'Pending' : 'Completed')}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-8 text-center">
                      <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-900 mb-1">No lab tests ordered</p>
                      <p className="text-xs text-gray-500">Laboratory test orders will appear here when requested</p>
                    </div>
                  );
                  })()}
                </>
              )}

              {activeTab === "notes" && (
                <>
                  {isAdminView && (
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => setShowConsultationForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors text-sm shadow-sm"
                      >
                        <Plus className="h-4 w-4" />
                        Add Consultation
                      </button>
                    </div>
                  )}
                  
                  {/* Encounters/Consultations */}
                  {patientData.encounters && patientData.encounters.length > 0 ? (
                    <div className="space-y-6">
                      {(() => {
                        // Group encounters by date
                        const encountersByDate = patientData.encounters.reduce((acc: any, encounter: any) => {
                          const getEncounterDate = () => {
                            if (encounter.encounterDatetime?.toDate) return encounter.encounterDatetime.toDate();
                            if (encounter.createdAt?.toDate) return encounter.createdAt.toDate();
                            if (encounter.encounterDatetime) return new Date(encounter.encounterDatetime);
                            if (encounter.createdAt) return new Date(encounter.createdAt);
                            return new Date();
                          };
                          const encounterDate = getEncounterDate();
                          if (encounterDate && !isNaN(encounterDate.getTime())) {
                            const date = formatDate(encounterDate.toISOString());
                            if (!acc[date]) acc[date] = [];
                            acc[date].push(encounter);
                          } else {
                            if (!acc['Unknown Date']) acc['Unknown Date'] = [];
                            acc['Unknown Date'].push(encounter);
                          }
                          return acc;
                        }, {} as Record<string, typeof patientData.encounters>);

                        const sortedDates = Object.keys(encountersByDate).sort((a, b) => 
                          new Date(b).getTime() - new Date(a).getTime()
                        );

                        return sortedDates.map((date) => {
                          const dateEncounters = encountersByDate[date];
                          const firstEncounter = dateEncounters[0];
                          const getEncounterDate = () => {
                            if (firstEncounter.encounterDatetime?.toDate) return firstEncounter.encounterDatetime.toDate();
                            if (firstEncounter.createdAt?.toDate) return firstEncounter.createdAt.toDate();
                            if (firstEncounter.encounterDatetime) return new Date(firstEncounter.encounterDatetime);
                            if (firstEncounter.createdAt) return new Date(firstEncounter.createdAt);
                            return new Date();
                          };
                          const encounterDate = getEncounterDate();
                          
                          return (
                            <div key={date} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <Calendar className="h-5 w-5 text-gray-600" />
                                    <div>
                                      <h3 className="text-base font-semibold text-gray-800">{date}</h3>
                                      <p className="text-xs text-gray-600">{dateEncounters.length} consultation{dateEncounters.length > 1 ? 's' : ''}</p>
                                    </div>
                                  </div>
                                  {encounterDate && !isNaN(encounterDate.getTime()) && (
                                    <span className="text-xs text-gray-600 font-medium">
                                      {encounterDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="p-6">
                                <div className="space-y-4">
                                  {dateEncounters.map((encounter: any) => {
                                    const encounterType = encounter.encounterType || 'Consultation';
                                    const encounterTime = encounter.encounterDatetime?.toDate ? encounter.encounterDatetime.toDate() : new Date(encounter.encounterDatetime || encounter.createdAt);
                                    const notesPreview = encounter.notes ? (encounter.notes.length > 100 ? encounter.notes.substring(0, 100) + '...' : encounter.notes) : '';

                                    // Handle click - use ConsultationForm for consultations with structuredData, old modal for others
                                    const handleEncounterClick = () => {
                                      if (encounterType === 'Consultation' && encounter.structuredData) {
                                        setSelectedEncounter(encounter);
                                        setShowConsultationForm(true);
                                      } else {
                                        setSelectedEncounter(encounter);
                                      }
                                    };

                                    return (
                                      <div
                                        key={encounter.id || encounter.uuid}
                                        onClick={handleEncounterClick}
                                        className="border border-gray-100 bg-white rounded-xl shadow-sm p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div>
                                            <h4 className="text-sm font-semibold text-gray-800">{encounterType}</h4>
                                          </div>
                                          <span className="text-xs text-gray-600 font-medium">
                                            {encounterTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                          </span>
                                        </div>
                                        {notesPreview && (
                                          <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">{notesPreview}</p>
                                        )}
                                        {encounter.diagnosis && (
                                          <div className="mt-2">
                                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Diagnosis: </span>
                                            <span className="text-sm text-gray-800 font-medium">{encounter.diagnosis}</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-8 text-center">
                      <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-900 mb-1">No clinical notes available</p>
                      <p className="text-xs text-gray-500">Consultation notes will appear here when documented by your healthcare provider</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === "attachments" && (
                <>
                  {isAdminView && (
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => setShowClinicalNoteForm(true)}
                        className="flex items-center gap-2 bg-olive-500 hover:bg-olive-600 text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
                      >
                        <Plus className="h-4 w-4" />
                        Add Attachment
                      </button>
                    </div>
                  )}
                  
                  {/* Attachments by Date */}
                  {patientData.attachments && patientData.attachments.length > 0 ? (
                    <div className="space-y-4">
                      {(() => {
                        // Group attachments by date
                        const attachmentsByDate = patientData.attachments.reduce((acc: any, note: any) => {
                          const getNoteDate = () => {
                            if (note.obsDatetime?.toDate) return note.obsDatetime.toDate();
                            if (note.observationDate?.toDate) return note.observationDate.toDate();
                            if (note.createdAt?.toDate) return note.createdAt.toDate();
                            if (note.obsDatetime) return new Date(note.obsDatetime);
                            if (note.observationDate) return new Date(note.observationDate);
                            if (note.createdAt) return new Date(note.createdAt);
                            return new Date();
                          };
                          const noteDate = getNoteDate();
                          if (noteDate && !isNaN(noteDate.getTime())) {
                            const date = formatDate(noteDate.toISOString());
                            if (!acc[date]) acc[date] = [];
                            acc[date].push(note);
                          } else {
                            if (!acc['Unknown Date']) acc['Unknown Date'] = [];
                            acc['Unknown Date'].push(note);
                          }
                          return acc;
                        }, {} as Record<string, typeof patientData.attachments>);

                        const sortedDates = Object.keys(attachmentsByDate).sort((a, b) => 
                          new Date(b).getTime() - new Date(a).getTime()
                        );

                        return sortedDates.map((date) => {
                          const dateNotes = attachmentsByDate[date];
                          const firstNote = dateNotes[0];
                          const getNoteDate = () => {
                            if (firstNote.obsDatetime?.toDate) return firstNote.obsDatetime.toDate();
                            if (firstNote.observationDate?.toDate) return firstNote.observationDate.toDate();
                            if (firstNote.createdAt?.toDate) return firstNote.createdAt.toDate();
                            if (firstNote.obsDatetime) return new Date(firstNote.obsDatetime);
                            if (firstNote.observationDate) return new Date(firstNote.observationDate);
                            if (firstNote.createdAt) return new Date(firstNote.createdAt);
                            return new Date();
                          };
                          const noteDate = getNoteDate();
                          
                          return (
                            <div key={date} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <Calendar className="h-5 w-5 text-gray-600" />
                                    <div>
                                      <h3 className="text-base font-semibold text-gray-800">{date}</h3>
                                      <p className="text-xs text-gray-600">{dateNotes.length} attachment{dateNotes.length > 1 ? 's' : ''}</p>
                                    </div>
                                  </div>
                                  {noteDate && !isNaN(noteDate.getTime()) && (
                                    <span className="text-xs text-gray-600 font-medium">
                                      {noteDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="p-6">
                                <div className="space-y-3">
                                  {dateNotes.map((note: any) => {
                                    const noteName = note.conceptName || note.concept?.display || note.conceptDisplay || 'Attachment';
                                    const noteTime = note.obsDatetime?.toDate ? note.obsDatetime.toDate() : new Date(note.obsDatetime || note.observationDate);
                                    const notePreview = note.value || note.valueText || '';
                                    const hasAttachments = note.metadata?.images?.length > 0 || note.metadata?.files?.length > 0;
                                    return (
                                      <div 
                                        key={note.uuid || note.id} 
                                        onClick={() => setSelectedClinicalNote(note)}
                                        className="border border-gray-100 bg-white rounded-xl shadow-sm p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center space-x-2">
                                            <span className="text-sm font-semibold text-gray-800">{noteName}</span>
                                            {hasAttachments && (
                                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
                                                {note.metadata?.images?.length || 0} image{(note.metadata?.images?.length || 0) > 1 ? 's' : ''} • {note.metadata?.files?.length || 0} file{(note.metadata?.files?.length || 0) > 1 ? 's' : ''}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-xs text-gray-600 font-medium">
                                            {noteTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">{notePreview}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-8 text-center">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-900 mb-1">No attachments available</p>
                      <p className="text-xs text-gray-500">Attachments with images and files will appear here when added</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === "visits" && (
                <>
                  
                  {/* Visits with Comprehensive Details */}
                  {patientData.visits.length > 0 ? (
                    <div className="space-y-6">
                      {patientData.visits.map((visit, visitIndex) => {
                        // Get vitals for this visit (by date range)
                        const visitDate = visit.startDatetime?.toDate ? visit.startDatetime.toDate() : new Date(visit.startDatetime || visit.startDate);
                        const visitVitals = patientData.vitals.filter(vital => {
                          const vitalDate = vital.obsDatetime?.toDate ? vital.obsDatetime.toDate() : new Date(vital.obsDatetime || vital.observationDate);
                          return vitalDate.toDateString() === visitDate.toDateString();
                        });

                        // Get encounters (consultations) for this visit (by date range)
                        const visitEncounters = (patientData.encounters || []).filter((encounter: any) => {
                          const encounterDate = encounter.encounterDatetime?.toDate ? encounter.encounterDatetime.toDate() : new Date(encounter.encounterDatetime || encounter.createdAt);
                          return encounterDate.toDateString() === visitDate.toDateString();
                        });

                        // Get attachments for this visit (by date range)
                        const visitAttachments = (patientData.attachments || []).filter((note: any) => {
                          const noteDate = note.obsDatetime?.toDate ? note.obsDatetime.toDate() : new Date(note.obsDatetime || note.observationDate);
                          return noteDate.toDateString() === visitDate.toDateString();
                        });

                        // Get medications for this visit (by date range)
                        const visitMedications = (patientData.medications || []).filter((med: any) => {
                          const getMedDate = () => {
                            if (med.prescribedDate?.toDate) return med.prescribedDate.toDate();
                            if (med.startDate?.toDate) return med.startDate.toDate();
                            if (med.dateActivated?.toDate) return med.dateActivated.toDate();
                            if (med.createdAt?.toDate) return med.createdAt.toDate();
                            if (med.prescribedDate) return new Date(med.prescribedDate);
                            if (med.startDate) return new Date(med.startDate);
                            if (med.dateActivated) return new Date(med.dateActivated);
                            if (med.createdAt) return new Date(med.createdAt);
                            return null;
                          };
                          const medDate = getMedDate();
                          return medDate && medDate.toDateString() === visitDate.toDateString();
                        });

                        // Get lab tests for this visit (by date range)
                        const visitLabTests = (patientData.labTests || []).filter((test: any) => {
                          const getTestDate = () => {
                            if (test.observationDate?.toDate) return test.observationDate.toDate();
                            if (test.obsDatetime?.toDate) return test.obsDatetime.toDate();
                            if (test.dateActivated?.toDate) return test.dateActivated.toDate();
                            if (test.createdAt?.toDate) return test.createdAt.toDate();
                            if (test.observationDate) return new Date(test.observationDate);
                            if (test.obsDatetime) return new Date(test.obsDatetime);
                            if (test.dateActivated) return new Date(test.dateActivated);
                            if (test.createdAt) return new Date(test.createdAt);
                            return null;
                          };
                          const testDate = getTestDate();
                          return testDate && testDate.toDateString() === visitDate.toDateString();
                        });

                        return (
                          <div key={visit.id || visit.uuid} className="bg-white border border-gray-100 overflow-hidden">
                            {/* Visit Header */}
                            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                    <Calendar className="h-5 w-5 text-indigo-600" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-gray-900">
                                      {visit.visitType?.display || visit.visitType || 'Outpatient Visit'}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                      {(() => {
                                        const startDate = visit.startDatetime?.toDate ? visit.startDatetime.toDate() : new Date(visit.startDatetime || visit.startDate);
                                        const stopDate = visit.stopDatetime?.toDate ? visit.stopDatetime.toDate() : (visit.stopDatetime ? new Date(visit.stopDatetime) : null);
                                        return `${formatDate(startDate.toISOString())}${stopDate ? ` - ${formatDate(stopDate.toISOString())}` : ' - Active'}`;
                                      })()}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Location: {visit.location?.display || visit.location || 'OKB Clinic'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${
                                    visit.stopDatetime ? 'border-green-200 text-green-700 bg-green-50' : 'border-blue-200 text-blue-700 bg-blue-50'
                                  }`}>
                                    {visit.stopDatetime ? 'Completed' : 'Active'}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const element = document.getElementById(`visit-${visitIndex}`);
                                      if (element) {
                                        element.classList.toggle('hidden');
                                      }
                                    }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    <ChevronDown className="h-5 w-5" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Visit Details */}
                            <div id={`visit-${visitIndex}`} className="border-t border-gray-100">
                              <div className="p-6">


                                {/* Data Sections */}
                                <div className="space-y-6">
                                  {/* Vital Signs */}
                                  {visitVitals.length > 0 && (
                                    <div>
                                      <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                                        <h4 className="text-base font-semibold text-gray-800 tracking-tight">Vital Signs</h4>
                                        {(() => {
                                          // Get the most recent time from all vitals (they should all be similar for same visit)
                                          const firstVital = visitVitals[0];
                                          const vitalDate = firstVital.obsDatetime?.toDate ? firstVital.obsDatetime.toDate() : new Date(firstVital.obsDatetime || firstVital.observationDate);
                                          return (
                                            <span className="text-xs text-gray-600 font-medium">
                                              {vitalDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      <div className="border border-gray-100 bg-white">
                                        <table className="w-full text-sm">
                                          <thead className="bg-gray-100 border-b-2 border-gray-200">
                                            <tr>
                                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Vital Sign</th>
                                              <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wide">Value</th>
                                              <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wide">Normal Range</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                            {(() => {
                                              // Group blood pressure readings together
                                              const groupedVitals: any[] = [];
                                              const bpSystolic = visitVitals.find((v: any) => 
                                                v.conceptCode === 'systolic_bp' || 
                                                v.conceptDisplay?.toLowerCase().includes('systolic')
                                              );
                                              const bpDiastolic = visitVitals.find((v: any) => 
                                                v.conceptCode === 'diastolic_bp' || 
                                                v.conceptDisplay?.toLowerCase().includes('diastolic')
                                              );
                                              
                                              // Add BP as combined entry if both exist
                                              if (bpSystolic && bpDiastolic) {
                                                const systolicValue = typeof bpSystolic.value === "object" ? bpSystolic.value.display : bpSystolic.value;
                                                const diastolicValue = typeof bpDiastolic.value === "object" ? bpDiastolic.value.display : bpDiastolic.value;
                                                groupedVitals.push({
                                                  ...bpSystolic,
                                                  combined: true,
                                                  displayValue: `${systolicValue}/${diastolicValue}`,
                                                  unit: 'mmHg',
                                                  referenceRange: '90-140/60-90'
                                                });
                                              }
                                              
                                              // Add other vitals (excluding individual BP readings)
                                              visitVitals.forEach((vital: any) => {
                                                const isBP = vital.conceptCode === 'systolic_bp' || 
                                                           vital.conceptCode === 'diastolic_bp' ||
                                                           vital.conceptDisplay?.toLowerCase().includes('systolic') ||
                                                           vital.conceptDisplay?.toLowerCase().includes('diastolic');
                                                if (!isBP) {
                                                  const vitalName = vital.conceptDisplay || vital.conceptName || vital.concept?.display || 'Vital Sign';
                                                  const vitalValue = (vital.value != null && typeof vital.value === "object") ? vital.value.display : (vital.value ?? '');
                                                  const vitalUnit = vital.unit || '';
                                                  
                                                  // Reference ranges for common vitals
                                                  let referenceRange = '';
                                                  const code = vital.conceptCode?.toLowerCase() || vitalName.toLowerCase();
                                                  if (code.includes('temperature') || code.includes('temp')) {
                                                    referenceRange = '36.1-37.2°C';
                                                  } else if (code.includes('pulse') || code.includes('heart rate')) {
                                                    referenceRange = '60-100 bpm';
                                                  } else if (code.includes('respiratory') || code.includes('resp rate')) {
                                                    referenceRange = '12-20 /min';
                                                  } else if (code.includes('oxygen') || code.includes('spo2') || code.includes('o2 sat')) {
                                                    referenceRange = '95-100%';
                                                  } else if (code.includes('weight')) {
                                                    referenceRange = 'Varies by age/height';
                                                  } else if (code.includes('height')) {
                                                    referenceRange = 'Varies by age';
                                                  } else if (code.includes('fbs') || code.includes('fasting')) {
                                                    referenceRange = '70-100 mg/dL';
                                                  } else if (code.includes('rbs') || code.includes('random')) {
                                                    referenceRange = '<140 mg/dL';
                                                  }
                                                  
                                                  groupedVitals.push({
                                                    ...vital,
                                                    displayValue: `${vitalValue} ${vitalUnit}`,
                                                    referenceRange
                                                  });
                                                }
                                              });
                                              
                                              return groupedVitals.map((vital: any) => {
                                                const vitalName = vital.combined ? 'Blood Pressure' : 
                                                                  (vital.conceptDisplay || vital.conceptName || vital.concept?.display || 'Vital Sign');
                                                
                                                // Check if value is abnormal (basic checks)
                                                const isAbnormal = (() => {
                                                  if (vital.combined) {
                                                    const [systolic, diastolic] = vital.displayValue.split('/').map(Number);
                                                    return systolic > 140 || systolic < 90 || diastolic > 90 || diastolic < 60;
                                                  }
                                                  const code = vital.conceptCode?.toLowerCase() || vitalName.toLowerCase();
                                                  const numValue = parseFloat(vital.displayValue);
                                                  if (isNaN(numValue)) return false;
                                                  
                                                  if (code.includes('temperature')) {
                                                    return numValue > 37.5 || numValue < 35;
                                                  } else if (code.includes('pulse')) {
                                                    return numValue > 100 || numValue < 60;
                                                  } else if (code.includes('respiratory')) {
                                                    return numValue > 20 || numValue < 12;
                                                  } else if (code.includes('oxygen')) {
                                                    return numValue < 95;
                                                  } else if (code.includes('fbs')) {
                                                    return numValue > 126;
                                                  } else if (code.includes('rbs')) {
                                                    return numValue > 200;
                                                  }
                                                  return false;
                                                })();
                                                
                                                return (
                                                  <tr key={vital.uuid || vital.id} className={isAbnormal ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''}>
                                                    <td className="px-4 py-2.5 text-sm font-medium text-gray-800">
                                                      {vitalName}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right">
                                                      <div className="flex items-center justify-end gap-2">
                                                        <span className={`text-sm font-semibold tabular-nums ${isAbnormal ? 'text-amber-700' : 'text-gray-900'}`}>
                                                          {vital.displayValue || ((vital.value != null && typeof vital.value === "object") ? vital.value.display : (vital.value ?? '')) + ' ' + (vital.unit || '')}
                                                        </span>
                                                        {isAbnormal && (
                                                          <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                                                            ABN
                                                          </span>
                                                        )}
                                                      </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-xs text-gray-600 font-mono">
                                                      {vital.referenceRange || '—'}
                                                    </td>
                                                  </tr>
                                                );
                                              });
                                            })()}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Medications */}
                                  {visitMedications.length > 0 && (
                                    <div>
                                      <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                                        <h4 className="text-base font-semibold text-gray-800 tracking-tight">Medications</h4>
                                      </div>
                                      <div className="border border-gray-100 bg-white">
                                        <table className="w-full text-sm">
                                          <thead className="bg-gray-100 border-b-2 border-gray-200">
                                            <tr>
                                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Medication</th>
                                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Dosage</th>
                                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Frequency</th>
                                              <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wide">Status</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                            {visitMedications.map((med: any) => {
                                              const medName = med.drugName || med.medicationName || med.display || 'Medication';
                                              const isPending = med.status?.toLowerCase() === 'pending';
                                              return (
                                                <tr key={med.id || med.uuid} className={isPending ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''}>
                                                  <td className="px-4 py-2.5 text-sm font-medium text-gray-800">
                                                    {medName}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-sm text-gray-700">
                                                    {med.dosage ? `${med.dosage} ${med.dosageUnit || ''}` : '—'}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-sm text-gray-700">
                                                    {med.frequency || '—'}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-right">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-semibold ${
                                                      isPending 
                                                        ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                    } whitespace-nowrap`}>
                                                      {med.status || (isPending ? 'Pending' : 'Active')}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Lab Tests */}
                                  {visitLabTests.length > 0 && (
                                    <div>
                                      <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                                        <h4 className="text-base font-semibold text-gray-800 tracking-tight">Lab Tests</h4>
                                      </div>
                                      <div className="border border-gray-100 bg-white">
                                        <table className="w-full text-sm">
                                          <thead className="bg-gray-100 border-b-2 border-gray-200">
                                            <tr>
                                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">Test</th>
                                              <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wide">Result</th>
                                              <th className="px-4 py-2 text-right text-xs font-bold text-gray-700 uppercase tracking-wide">Status</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                            {visitLabTests.map((test: any) => {
                                              const testName = test.conceptName || test.conceptDisplay || test.display || 'Lab Test';
                                              const testValue = typeof test.value === "object" ? test.value.display : test.value;
                                              const isPending = test.status?.toLowerCase() === 'pending';
                                              return (
                                                <tr key={test.id || test.uuid} className={isPending ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''}>
                                                  <td className="px-4 py-2.5 text-sm font-medium text-gray-800">
                                                    {testName}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-gray-900">
                                                    {testValue || '—'}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-right">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-semibold ${
                                                      isPending 
                                                        ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                                        : 'bg-purple-100 text-purple-800 border border-purple-300'
                                                    } whitespace-nowrap`}>
                                                      {test.status || (isPending ? 'Pending' : 'Completed')}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Clinical Notes (Consultations) */}
                                  {visitEncounters.length > 0 && (
                                    <div>
                                      <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                                        <h4 className="text-base font-semibold text-gray-800 tracking-tight">Clinical Notes</h4>
                                      </div>
                                      <div className="space-y-3">
                                        {visitEncounters.map((encounter: any) => {
                                          const encounterType = encounter.encounterType || 'Consultation';
                                          const encounterTime = encounter.encounterDatetime?.toDate ? encounter.encounterDatetime.toDate() : new Date(encounter.encounterDatetime || encounter.createdAt);
                                          return (
                                            <div key={encounter.id || encounter.uuid} className="border border-gray-100 bg-white rounded-xl shadow-sm p-4">
                                              <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-semibold text-gray-800">{encounterType}</span>
                                                <span className="text-xs text-gray-600 font-medium">
                                                  {encounterTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                              </div>
                                              {encounter.notes && (
                                                <p className="text-sm text-gray-700 leading-relaxed mb-2">{encounter.notes}</p>
                                              )}
                                              {encounter.diagnosis && (
                                                <p className="text-xs text-gray-600">
                                                  <span className="font-semibold">Diagnosis:</span> {encounter.diagnosis}
                                                </p>
                                              )}
                                              <p className="text-xs text-gray-500 mt-2">
                                                Provider: {encounter.providerName || encounter.provider || 'Unknown User'}
                                              </p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Attachments */}
                                  {visitAttachments.length > 0 && (
                                    <div>
                                      <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                                        <h4 className="text-base font-semibold text-gray-800 tracking-tight">Attachments</h4>
                                      </div>
                                      <div className="space-y-3">
                                        {visitAttachments.map((note: any) => {
                                          const noteName = note.conceptName || note.concept?.display || note.conceptDisplay || 'Attachment';
                                          const noteDate = note.obsDatetime?.toDate ? note.obsDatetime.toDate() : new Date(note.obsDatetime || note.observationDate);
                                          return (
                                            <div 
                                              key={note.uuid || note.id} 
                                              onClick={() => setSelectedClinicalNote(note)}
                                              className="border border-gray-100 bg-white rounded-xl shadow-sm p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                            >
                                              <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-semibold text-gray-800">{noteName}</span>
                                                <span className="text-xs text-gray-600 font-medium">
                                                  {noteDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                              </div>
                                              <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">{note.value || note.valueText || ''}</p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Empty State */}
                                  {visitVitals.length === 0 && visitMedications.length === 0 && visitLabTests.length === 0 && visitEncounters.length === 0 && visitAttachments.length === 0 && (
                                    <div className="text-center py-8">
                                      <div className="text-gray-400 text-sm">No detailed information available for this visit</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-900 mb-1">No visit history available</p>
                      <p className="text-xs text-gray-500">Your healthcare visits will appear here when scheduled or completed</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Form Modals (Admin Only) */}
      {isAdminView && patientData?.patient && (
        <>
          {showVitalsForm && (
            <VitalsForm
              patientUuid={getPatientUuid(patientData.patient)}
              patientName={getPatientName(patientData.patient)}
              onClose={() => setShowVitalsForm(false)}
              onSuccess={() => {
                setShowVitalsForm(false);
                loadPatientData(); // Reload data to show new vitals
              }}
            />
          )}

          {showConsultationForm && (
            <ConsultationForm
              patientUuid={getPatientUuid(patientData.patient)}
              patientName={getPatientName(patientData.patient)}
              onClose={() => {
                setShowConsultationForm(false);
                setSelectedEncounter(null);
              }}
              onSuccess={() => {
                setShowConsultationForm(false);
                setSelectedEncounter(null);
                loadPatientData(); // Reload data to show new encounter
              }}
              existingEncounter={selectedEncounter}
              viewMode={!!selectedEncounter?.structuredData}
            />
          )}

          {showOrderForm && (
            <AddOrderForm
              patientUuid={getPatientUuid(patientData.patient)}
              patientName={getPatientName(patientData.patient)}
              orderType={orderFormType}
              onClose={() => setShowOrderForm(false)}
              onSuccess={() => {
                setShowOrderForm(false);
                loadPatientData(); // Reload data to show new orders
              }}
            />
          )}

          {showClinicalNoteForm && patientData && (
            <ClinicalNoteForm
              patientUuid={getPatientUuid(patientData.patient)}
              patientName={getPatientName(patientData.patient)}
              onClose={() => setShowClinicalNoteForm(false)}
              onSuccess={() => {
                setShowClinicalNoteForm(false);
                loadPatientData(); // Reload data to show new note
              }}
            />
          )}

          {showReferPatientModal && patientData && (
            <ReferPatientModal
              patientId={getPatientUuid(patientData.patient)}
              patientName={getPatientName(patientData.patient)}
              onClose={() => setShowReferPatientModal(false)}
              onSuccess={() => {
                loadPatientData(); // Reload data to show updated referral status
              }}
            />
          )}

          {showFollowUpModal && patientData && (
            <FollowUpModal
              patientId={getPatientUuid(patientData.patient)}
              patientName={getPatientName(patientData.patient)}
              onClose={() => setShowFollowUpModal(false)}
              onSuccess={() => {
                loadPatientData(); // Reload data to show updated follow-up status
              }}
            />
          )}
        </>
      )}

      {/* Patient Details Modal */}
      {showPatientDetailsModal && patientData?.patient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Patient Details</h2>
              <div className="flex items-center gap-2">
                {!isEditingPatient && (
                  <button
                    onClick={handleEditPatient}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-olive-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsEditingPatient(false);
                    setPatientEditData(null);
                    setShowPatientDetailsModal(false);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Information Card */}
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-600" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <dt className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Full Name</dt>
                    <dd className="text-sm font-semibold text-gray-900">
                      {getPatientName(patientData.patient)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Gender</dt>
                    <dd className="text-sm font-semibold text-gray-900">
                      {getPatientGender(patientData.patient) === 'M' ? 'Male' : getPatientGender(patientData.patient) === 'F' ? 'Female' : 'Other'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Date of Birth</dt>
                    <dd className="text-sm font-semibold text-gray-900">
                      {(() => {
                        const birthdateInfo = formatBirthdate(patientData.patient);
                        if (!birthdateInfo) {
                          return <span className="text-gray-400 italic font-normal">Not provided</span>;
                        }
                        return (
                          <span>
                            {birthdateInfo.formatted}
                            {birthdateInfo.isEstimated && (
                              <span className="text-xs text-gray-500 font-normal ml-2">(Estimated)</span>
                            )}
                          </span>
                        );
                      })()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Age</dt>
                    <dd className="text-sm font-semibold text-gray-900">
                      {(patientData.patient as any).age || 'N/A'} years old
                    </dd>
                  </div>
                </div>
              </div>

              {/* Contact Information Card */}
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-600" />
                  Contact Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Phone Number</label>
                    {isEditingPatient ? (
                      <input
                        type="tel"
                        value={patientEditData?.phoneNumber || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, phoneNumber: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter phone number"
                      />
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900">
                        {(patientData.patient as any).phoneNumber || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Email</label>
                    {isEditingPatient ? (
                      <input
                        type="email"
                        value={patientEditData?.email || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, email: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter email address"
                      />
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900">
                        {(patientData.patient as any).email || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                  {isEditingPatient ? (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Address Line 1</label>
                        <input
                          type="text"
                          value={patientEditData?.address?.line1 || ''}
                          onChange={(e) => setPatientEditData({ ...patientEditData, address: { ...patientEditData?.address, line1: e.target.value } })}
                          className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Street address"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Address Line 2</label>
                        <input
                          type="text"
                          value={patientEditData?.address?.line2 || ''}
                          onChange={(e) => setPatientEditData({ ...patientEditData, address: { ...patientEditData?.address, line2: e.target.value } })}
                          className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Apartment, suite, etc."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">City</label>
                        <input
                          type="text"
                          value={patientEditData?.address?.city || ''}
                          onChange={(e) => setPatientEditData({ ...patientEditData, address: { ...patientEditData?.address, city: e.target.value } })}
                          className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">State/Region</label>
                        <input
                          type="text"
                          value={patientEditData?.address?.state || ''}
                          onChange={(e) => setPatientEditData({ ...patientEditData, address: { ...patientEditData?.address, state: e.target.value } })}
                          className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="State or region"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Country</label>
                        <input
                          type="text"
                          value={patientEditData?.address?.country || ''}
                          onChange={(e) => setPatientEditData({ ...patientEditData, address: { ...patientEditData?.address, country: e.target.value } })}
                          className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Country"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2">
                      <dt className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Address</dt>
                      <dd className="text-sm font-semibold text-gray-900">
                        {[
                          (patientData.patient as any).address?.line1,
                          (patientData.patient as any).address?.line2,
                          (patientData.patient as any).address?.city,
                          (patientData.patient as any).address?.state,
                        ].filter(Boolean).join(', ') || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Community</label>
                    {isEditingPatient ? (
                      <input
                        type="text"
                        value={patientEditData?.community || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, community: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter community"
                      />
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900">
                        {(patientData.patient as any).community || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                </div>
              </div>

              {/* Identifiers Card */}
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-600" />
                  Identifiers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">System Identifier</label>
                    <dd className="text-sm font-semibold text-gray-900 font-mono">
                      {(patientData.patient as any).identifier || 'N/A'}
                    </dd>
                    <p className="text-xs text-gray-500 mt-1">Cannot be edited</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Ghana Card Number</label>
                    {isEditingPatient ? (
                      <input
                        type="text"
                        value={patientEditData?.ghanaCardNumber || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, ghanaCardNumber: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        placeholder="Enter Ghana Card number"
                      />
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900 font-mono">
                        {(patientData.patient as any).ghanaCardNumber || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">NHIS Number</label>
                    {isEditingPatient ? (
                      <input
                        type="text"
                        value={patientEditData?.nhisNumber || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, nhisNumber: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        placeholder="Enter NHIS number"
                      />
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900 font-mono">
                        {(patientData.patient as any).nhisNumber || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional Information Card */}
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-600" />
                  Additional Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Religion</label>
                    {isEditingPatient ? (
                      <input
                        type="text"
                        value={patientEditData?.religion || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, religion: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter religion"
                      />
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900">
                        {(patientData.patient as any).religion || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Occupation</label>
                    {isEditingPatient ? (
                      <input
                        type="text"
                        value={patientEditData?.occupation || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, occupation: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter occupation"
                      />
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900">
                        {(patientData.patient as any).occupation || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Marital Status</label>
                    {isEditingPatient ? (
                      <select
                        value={patientEditData?.maritalStatus || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, maritalStatus: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select...</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900">
                        {(patientData.patient as any).maritalStatus || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Education Level</label>
                    {isEditingPatient ? (
                      <select
                        value={patientEditData?.educationLevel || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, educationLevel: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select...</option>
                        <option value="None">None</option>
                        <option value="Primary">Primary</option>
                        <option value="Secondary">Secondary</option>
                        <option value="Tertiary">Tertiary</option>
                      </select>
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900">
                        {(patientData.patient as any).educationLevel || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                </div>
              </div>

              {/* Emergency Contact Card */}
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-gray-600" />
                  Emergency Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Contact Name</label>
                    {isEditingPatient ? (
                      <input
                        type="text"
                        value={patientEditData?.emergencyContactName || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, emergencyContactName: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter contact name"
                      />
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900">
                        {(patientData.patient as any).emergencyContactName || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Contact Phone</label>
                    {isEditingPatient ? (
                      <input
                        type="tel"
                        value={patientEditData?.emergencyContactPhone || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, emergencyContactPhone: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter contact phone"
                      />
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900">
                        {(patientData.patient as any).emergencyContactPhone || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Relationship</label>
                    {isEditingPatient ? (
                      <input
                        type="text"
                        value={patientEditData?.emergencyContactRelationship || ''}
                        onChange={(e) => setPatientEditData({ ...patientEditData, emergencyContactRelationship: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Spouse, Parent, Sibling"
                      />
                    ) : (
                      <dd className="text-sm font-semibold text-gray-900">
                        {(patientData.patient as any).emergencyContactRelationship || <span className="text-gray-400 italic font-normal">Not provided</span>}
                      </dd>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
              {isEditingPatient ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    disabled={savingPatient}
                    className="px-6 py-2 bg-white border border-gray-100 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePatient}
                    disabled={savingPatient}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingPatient ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsEditingPatient(false);
                    setPatientEditData(null);
                    setShowPatientDetailsModal(false);
                  }}
                  className="px-6 py-2 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Medication Details Modal */}
      {selectedMedication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={(e) => {
          if (e.target === e.currentTarget && !editingMedication) {
            setSelectedMedication(null);
          }
        }}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Pill className={`h-5 w-5 ${editingMedication ? 'text-amber-600' : 'text-emerald-600'}`} />
                <h2 className="text-xl font-bold text-gray-900">
                  {editingMedication ? 'Edit Medication' : 'Medication Details'}
                </h2>
              </div>
              <button
                onClick={() => {
                  if (editingMedication) {
                    handleCancelMedicationEdit();
                  } else {
                    setSelectedMedication(null);
                  }
                }}
                disabled={medicationActionLoading}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Medication Name - Always read-only */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Medication Name
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700">
                  {selectedMedication.drugName || selectedMedication.display || 'Medication'}
                </div>
              </div>

              {/* Dosage - Editable when in edit mode */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Dosage
                </label>
                {editingMedication ? (
                  <input
                    type="text"
                    value={medicationEditData?.dosage || ''}
                    onChange={(e) => setMedicationEditData({ ...medicationEditData, dosage: e.target.value })}
                    placeholder="e.g., 500mg twice daily"
                    className="w-full px-4 py-3 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700">
                    {selectedMedication.dosage ? `${selectedMedication.dosage} ${selectedMedication.dosageUnit || ''}` : '—'}
                  </div>
                )}
              </div>

              {/* Quantity - Editable when in edit mode */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantity
                </label>
                {editingMedication ? (
                  <input
                    type="number"
                    value={medicationEditData?.quantity || '1'}
                    onChange={(e) => setMedicationEditData({ ...medicationEditData, quantity: e.target.value })}
                    min="1"
                    className="w-full px-4 py-3 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700">
                    {selectedMedication.quantity || 1}
                  </div>
                )}
              </div>

              {/* Frequency - Read-only */}
              {selectedMedication.frequency && !editingMedication && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Frequency
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700">
                    {selectedMedication.frequency}
                  </div>
                </div>
              )}

              {/* Instructions - Editable when in edit mode */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Instructions
                </label>
                {editingMedication ? (
                  <textarea
                    value={medicationEditData?.instructions || ''}
                    onChange={(e) => setMedicationEditData({ ...medicationEditData, instructions: e.target.value })}
                    placeholder="Additional instructions..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700 whitespace-pre-wrap">
                    {selectedMedication.instructions || '—'}
                  </div>
                )}
              </div>

              {/* Prescribed By - Read-only */}
              {selectedMedication.prescribedByName && !editingMedication && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Prescribed By
                  </label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700">
                    {selectedMedication.prescribedByName}
                  </div>
                </div>
              )}

              {/* Status - Read-only */}
              {!editingMedication && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Status
                  </label>
                  <div className="px-4 py-3">
                    <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getStatusVariant(selectedMedication.status)}`}>
                      {selectedMedication.status || "Active"}
                    </span>
                  </div>
                </div>
              )}

              {/* Date - Read-only */}
              {!editingMedication && (() => {
                const getMedDate = () => {
                  if (selectedMedication.prescribedDate?.toDate) return selectedMedication.prescribedDate.toDate();
                  if (selectedMedication.startDate?.toDate) return selectedMedication.startDate.toDate();
                  if (selectedMedication.dateActivated?.toDate) return selectedMedication.dateActivated.toDate();
                  if (selectedMedication.createdAt?.toDate) return selectedMedication.createdAt.toDate();
                  if (selectedMedication.prescribedDate) return new Date(selectedMedication.prescribedDate);
                  if (selectedMedication.startDate) return new Date(selectedMedication.startDate);
                  if (selectedMedication.dateActivated) return new Date(selectedMedication.dateActivated);
                  if (selectedMedication.createdAt) return new Date(selectedMedication.createdAt);
                  return null;
                };
                const medDate = getMedDate();
                const isValidDate = medDate && !isNaN(medDate.getTime());
                const isPending = selectedMedication.status?.toLowerCase() === 'pending';

                if (isValidDate) {
                  return (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {isPending ? 'Ordered Date' : 'Start Date'}
                      </label>
                      <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700">
                        {formatDate(medDate.toISOString())}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t border-gray-100">
                {/* Edit/Cancel buttons for pending orders (admin view only) */}
                {isAdminView && selectedMedication.status?.toLowerCase() === 'pending' && !editingMedication && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleEditMedication}
                      disabled={medicationActionLoading}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={handleCancelMedicationOrder}
                      disabled={medicationActionLoading}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                      {medicationActionLoading ? 'Canceling...' : 'Cancel Order'}
                    </button>
                  </div>
                )}

                {/* Editing mode actions */}
                {editingMedication && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelMedicationEdit}
                      disabled={medicationActionLoading}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveMedicationEdit}
                      disabled={medicationActionLoading}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {medicationActionLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}

                {/* Close button */}
                {!editingMedication && (
                  <button
                    onClick={() => setSelectedMedication(null)}
                    className="px-6 py-2.5 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors ml-auto"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lab Test Details Modal */}
      {selectedLabTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedLabTest(null);
          }
        }}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TestTube className="h-5 w-5 text-purple-600" />
                <h2 className="text-xl font-bold text-gray-900">Lab Test Details</h2>
              </div>
              <button
                onClick={() => setSelectedLabTest(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Test Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Test Type
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700">
                  {selectedLabTest.conceptName || selectedLabTest.conceptDisplay || selectedLabTest.display || 'Lab Test'}
                </div>
              </div>

              {/* Test Result */}
              {(() => {
                const testValue = typeof selectedLabTest.value === "object" ? selectedLabTest.value.display : selectedLabTest.value;
                const isPending = selectedLabTest.status?.toLowerCase() === 'pending';
                
                if (!isPending && testValue) {
                  return (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Test Result
                      </label>
                      <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-base font-semibold text-green-900">{testValue}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status
                </label>
                <div className="px-4 py-3">
                  <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getStatusVariant(selectedLabTest.status)}`}>
                    {selectedLabTest.status || "Completed"}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg min-h-[60px]">
                  {selectedLabTest.notes ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedLabTest.notes}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No notes provided</p>
                  )}
                </div>
              </div>

              {/* Date */}
              {(() => {
                const getTestDate = () => {
                  if (selectedLabTest.observationDate?.toDate) return selectedLabTest.observationDate.toDate();
                  if (selectedLabTest.obsDatetime?.toDate) return selectedLabTest.obsDatetime.toDate();
                  if (selectedLabTest.dateActivated?.toDate) return selectedLabTest.dateActivated.toDate();
                  if (selectedLabTest.createdAt?.toDate) return selectedLabTest.createdAt.toDate();
                  if (selectedLabTest.observationDate) return new Date(selectedLabTest.observationDate);
                  if (selectedLabTest.obsDatetime) return new Date(selectedLabTest.obsDatetime);
                  if (selectedLabTest.dateActivated) return new Date(selectedLabTest.dateActivated);
                  if (selectedLabTest.createdAt) return new Date(selectedLabTest.createdAt);
                  return null;
                };
                const testDate = getTestDate();
                const isValidDate = testDate && !isNaN(testDate.getTime());
                const isPending = selectedLabTest.status?.toLowerCase() === 'pending';
                
                if (isValidDate) {
                  return (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {isPending ? 'Ordered Date' : 'Completed Date'}
                      </label>
                      <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700">
                        {formatDate(testDate.toISOString())}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Actions */}
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  onClick={() => setSelectedLabTest(null)}
                  className="px-6 py-2.5 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Note (Encounter) Details Modal - only show for encounters WITHOUT structuredData (old format) or Vitals */}
      {selectedEncounter && !showConsultationForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedEncounter(null);
          }
        }}>
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <Stethoscope className="h-5 w-5 text-olive-600" />
                <h2 className="text-xl font-bold text-gray-900">Clinical Note Details</h2>
              </div>
              <button
                onClick={() => setSelectedEncounter(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  <p className="text-sm font-medium text-gray-800">{selectedEncounter.encounterType || 'Consultation'}</p>
                </div>
                {(() => {
                  const getEncounterDate = () => {
                    if (selectedEncounter.encounterDatetime?.toDate) return selectedEncounter.encounterDatetime.toDate();
                    if (selectedEncounter.createdAt?.toDate) return selectedEncounter.createdAt.toDate();
                    if (selectedEncounter.encounterDatetime) return new Date(selectedEncounter.encounterDatetime);
                    if (selectedEncounter.createdAt) return new Date(selectedEncounter.createdAt);
                    return null;
                  };
                  const encounterDate = getEncounterDate();
                  if (encounterDate && !isNaN(encounterDate.getTime())) {
                    return (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Date</p>
                        <p className="text-sm font-medium text-gray-800">{formatDate(encounterDate.toISOString())}</p>
                      </div>
                    );
                  }
                  return null;
                })()}
                {selectedEncounter.location && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Location</p>
                    <p className="text-sm font-medium text-gray-800">{selectedEncounter.location}</p>
                  </div>
                )}
                {selectedEncounter.providerName && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Provider</p>
                    <p className="text-sm font-medium text-gray-800">{selectedEncounter.providerName}</p>
                  </div>
                )}
              </div>

              {/* Vitals Data Display */}
              {selectedEncounter.vitalsData && (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Vital Signs
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedEncounter.vitalsData.bloodPressure && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Blood Pressure</p>
                        <p className="text-lg font-bold text-gray-800">{selectedEncounter.vitalsData.bloodPressure.display}</p>
                      </div>
                    )}
                    {selectedEncounter.vitalsData.pulse && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Pulse</p>
                        <p className="text-lg font-bold text-gray-800">{selectedEncounter.vitalsData.pulse.value} <span className="text-sm font-normal text-gray-500">{selectedEncounter.vitalsData.pulse.unit}</span></p>
                      </div>
                    )}
                    {selectedEncounter.vitalsData.temperature && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Temperature</p>
                        <p className="text-lg font-bold text-gray-800">{selectedEncounter.vitalsData.temperature.value} <span className="text-sm font-normal text-gray-500">{selectedEncounter.vitalsData.temperature.unit}</span></p>
                      </div>
                    )}
                    {selectedEncounter.vitalsData.weight && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Weight</p>
                        <p className="text-lg font-bold text-gray-800">{selectedEncounter.vitalsData.weight.value} <span className="text-sm font-normal text-gray-500">{selectedEncounter.vitalsData.weight.unit}</span></p>
                      </div>
                    )}
                    {selectedEncounter.vitalsData.height && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Height</p>
                        <p className="text-lg font-bold text-gray-800">{selectedEncounter.vitalsData.height.value} <span className="text-sm font-normal text-gray-500">{selectedEncounter.vitalsData.height.unit}</span></p>
                      </div>
                    )}
                    {selectedEncounter.vitalsData.bmi && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">BMI</p>
                        <p className="text-lg font-bold text-gray-800">{selectedEncounter.vitalsData.bmi.value} <span className="text-sm font-normal text-gray-500">{selectedEncounter.vitalsData.bmi.unit}</span></p>
                      </div>
                    )}
                    {selectedEncounter.vitalsData.respiratoryRate && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Respiratory Rate</p>
                        <p className="text-lg font-bold text-gray-800">{selectedEncounter.vitalsData.respiratoryRate.value} <span className="text-sm font-normal text-gray-500">{selectedEncounter.vitalsData.respiratoryRate.unit}</span></p>
                      </div>
                    )}
                    {selectedEncounter.vitalsData.oxygenSaturation && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Oxygen Saturation</p>
                        <p className="text-lg font-bold text-gray-800">{selectedEncounter.vitalsData.oxygenSaturation.value} <span className="text-sm font-normal text-gray-500">{selectedEncounter.vitalsData.oxygenSaturation.unit}</span></p>
                      </div>
                    )}
                    {selectedEncounter.vitalsData.fbs && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Fasting Blood Sugar</p>
                        <p className="text-lg font-bold text-gray-800">{selectedEncounter.vitalsData.fbs.value} <span className="text-sm font-normal text-gray-500">{selectedEncounter.vitalsData.fbs.unit}</span></p>
                      </div>
                    )}
                    {selectedEncounter.vitalsData.rbs && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Random Blood Sugar</p>
                        <p className="text-lg font-bold text-gray-800">{selectedEncounter.vitalsData.rbs.value} <span className="text-sm font-normal text-gray-500">{selectedEncounter.vitalsData.rbs.unit}</span></p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Structured Data Display (for Consultations) */}
              {selectedEncounter.structuredData ? (
                <>
                  {/* Complaints & History */}
                  {selectedEncounter.structuredData.complaintsHistory && (
                    (() => {
                      const ch = selectedEncounter.structuredData.complaintsHistory;
                      const hasContent = ch.presentingComplaint || ch.historyOfComplaint || ch.pregnancyStatus;
                      if (!hasContent) return null;
                      return (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs">1</span>
                            Complaints & History
                          </h3>
                          <div className="space-y-3">
                            {ch.presentingComplaint && (
                              <div>
                                <p className="text-xs font-medium text-blue-700 mb-1">Presenting Complaint</p>
                                <p className="text-sm text-gray-700">{ch.presentingComplaint}</p>
                              </div>
                            )}
                            {ch.historyOfComplaint && (
                              <div>
                                <p className="text-xs font-medium text-blue-700 mb-1">History of Complaint</p>
                                <p className="text-sm text-gray-700">{ch.historyOfComplaint}</p>
                              </div>
                            )}
                            {ch.pregnancyStatus && (
                              <div>
                                <p className="text-xs font-medium text-blue-700 mb-1">Pregnancy Status</p>
                                <p className="text-sm text-gray-700 capitalize">{ch.pregnancyStatus}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* Review of Systems */}
                  {selectedEncounter.structuredData.reviewOfSystems && (
                    (() => {
                      const ros = selectedEncounter.structuredData.reviewOfSystems;
                      const constitutionalSymptoms = ros.constitutional ? Object.entries(ros.constitutional).filter(([_, v]) => v === 'yes').map(([k]) => k.replace(/([A-Z])/g, ' $1').trim()) : [];
                      const musculoskeletalSymptoms = ros.musculoskeletal ? Object.entries(ros.musculoskeletal).filter(([_, v]) => v === 'yes').map(([k]) => k.replace(/([A-Z])/g, ' $1').trim()) : [];
                      const giSymptoms = ros.gastrointestinal ? Object.entries(ros.gastrointestinal).filter(([_, v]) => v === 'yes').map(([k]) => k.replace(/([A-Z])/g, ' $1').trim()) : [];
                      const hasSymptoms = constitutionalSymptoms.length > 0 || musculoskeletalSymptoms.length > 0 || giSymptoms.length > 0 || ros.additionalNotes;
                      if (!hasSymptoms) return null;
                      return (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center text-xs">2</span>
                            Review of Systems
                          </h3>
                          <div className="space-y-3">
                            {constitutionalSymptoms.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-amber-700 mb-1">Constitutional</p>
                                <div className="flex flex-wrap gap-1">
                                  {constitutionalSymptoms.map((symptom, i) => (
                                    <span key={i} className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded capitalize">{symptom}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {musculoskeletalSymptoms.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-amber-700 mb-1">Musculoskeletal</p>
                                <div className="flex flex-wrap gap-1">
                                  {musculoskeletalSymptoms.map((symptom, i) => (
                                    <span key={i} className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded capitalize">{symptom}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {giSymptoms.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-amber-700 mb-1">Gastrointestinal</p>
                                <div className="flex flex-wrap gap-1">
                                  {giSymptoms.map((symptom, i) => (
                                    <span key={i} className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded capitalize">{symptom}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {ros.additionalNotes && (
                              <div>
                                <p className="text-xs font-medium text-amber-700 mb-1">Additional Notes</p>
                                <p className="text-sm text-gray-700">{ros.additionalNotes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* Medical History */}
                  {selectedEncounter.structuredData.medicalHistory && (
                    (() => {
                      const mh = selectedEncounter.structuredData.medicalHistory;
                      const hasContent = mh.pastMedicalHistory || mh.obsGynHistory || mh.developmentHistory || mh.surgicalHistory || mh.drugHistory || mh.familyHistory || mh.socialHistory;
                      if (!hasContent) return null;
                      return (
                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center text-xs">3</span>
                            Medical History
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {mh.pastMedicalHistory && (
                              <div>
                                <p className="text-xs font-medium text-purple-700 mb-1">Past Medical History</p>
                                <p className="text-sm text-gray-700">{mh.pastMedicalHistory}</p>
                              </div>
                            )}
                            {mh.surgicalHistory && (
                              <div>
                                <p className="text-xs font-medium text-purple-700 mb-1">Surgical History</p>
                                <p className="text-sm text-gray-700">{mh.surgicalHistory}</p>
                              </div>
                            )}
                            {mh.drugHistory && (
                              <div>
                                <p className="text-xs font-medium text-purple-700 mb-1">Drug History</p>
                                <p className="text-sm text-gray-700">{mh.drugHistory}</p>
                              </div>
                            )}
                            {mh.familyHistory && (
                              <div>
                                <p className="text-xs font-medium text-purple-700 mb-1">Family History</p>
                                <p className="text-sm text-gray-700">{mh.familyHistory}</p>
                              </div>
                            )}
                            {mh.socialHistory && (
                              <div>
                                <p className="text-xs font-medium text-purple-700 mb-1">Social History</p>
                                <p className="text-sm text-gray-700">{mh.socialHistory}</p>
                              </div>
                            )}
                            {mh.obsGynHistory && (
                              <div>
                                <p className="text-xs font-medium text-purple-700 mb-1">Obs/Gyn History</p>
                                <p className="text-sm text-gray-700">{mh.obsGynHistory}</p>
                              </div>
                            )}
                            {mh.developmentHistory && (
                              <div>
                                <p className="text-xs font-medium text-purple-700 mb-1">Development History</p>
                                <p className="text-sm text-gray-700">{mh.developmentHistory}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* Physical Examination */}
                  {selectedEncounter.structuredData.physicalExamination && (
                    (() => {
                      const pe = selectedEncounter.structuredData.physicalExamination;
                      const hasContent = pe.generalObservations || pe.vitals?.bloodPressure || pe.vitals?.pulse || pe.cardiovascular || pe.respiratory || pe.abdominal || pe.cns || pe.ent || pe.genitourinary || pe.musculoskeletal || pe.eye || pe.statusLocalis || pe.skin;
                      if (!hasContent) return null;
                      return (
                        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                          <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 bg-green-200 rounded-full flex items-center justify-center text-xs">4</span>
                            Physical Examination
                          </h3>
                          <div className="space-y-3">
                            {/* Vitals */}
                            {(pe.vitals?.bloodPressure || pe.vitals?.pulse) && (
                              <div className="flex gap-4 pb-3 border-b border-green-200">
                                {pe.vitals?.bloodPressure && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-green-700">BP:</span>
                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-sm font-medium rounded">{pe.vitals.bloodPressure}</span>
                                  </div>
                                )}
                                {pe.vitals?.pulse && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-green-700">Pulse:</span>
                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-sm font-medium rounded">{pe.vitals.pulse} bpm</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {pe.generalObservations && (
                              <div>
                                <p className="text-xs font-medium text-green-700 mb-1">General Observations</p>
                                <p className="text-sm text-gray-700">{pe.generalObservations}</p>
                              </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {pe.cardiovascular && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">Cardiovascular</p>
                                  <p className="text-sm text-gray-700">{pe.cardiovascular}</p>
                                </div>
                              )}
                              {pe.respiratory && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">Respiratory</p>
                                  <p className="text-sm text-gray-700">{pe.respiratory}</p>
                                </div>
                              )}
                              {pe.abdominal && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">Abdominal</p>
                                  <p className="text-sm text-gray-700">{pe.abdominal}</p>
                                </div>
                              )}
                              {pe.cns && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">CNS</p>
                                  <p className="text-sm text-gray-700">{pe.cns}</p>
                                </div>
                              )}
                              {pe.ent && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">ENT</p>
                                  <p className="text-sm text-gray-700">{pe.ent}</p>
                                </div>
                              )}
                              {pe.eye && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">Eye</p>
                                  <p className="text-sm text-gray-700">{pe.eye}</p>
                                </div>
                              )}
                              {pe.genitourinary && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">Genitourinary</p>
                                  <p className="text-sm text-gray-700">{pe.genitourinary}</p>
                                </div>
                              )}
                              {pe.musculoskeletal && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">Musculoskeletal</p>
                                  <p className="text-sm text-gray-700">{pe.musculoskeletal}</p>
                                </div>
                              )}
                              {pe.skin && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">Skin</p>
                                  <p className="text-sm text-gray-700">{pe.skin}</p>
                                </div>
                              )}
                              {pe.statusLocalis && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">Status Localis</p>
                                  <p className="text-sm text-gray-700">{pe.statusLocalis}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* Diagnosis */}
                  {selectedEncounter.structuredData.diagnosisInfo && selectedEncounter.structuredData.diagnosisInfo.diagnosis && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 bg-red-200 rounded-full flex items-center justify-center text-xs">5</span>
                        Diagnosis
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          selectedEncounter.structuredData.diagnosisInfo.type === 'final' ? 'bg-red-200 text-red-800' :
                          selectedEncounter.structuredData.diagnosisInfo.type === 'provisional' ? 'bg-orange-200 text-orange-800' :
                          'bg-yellow-200 text-yellow-800'
                        }`}>
                          {selectedEncounter.structuredData.diagnosisInfo.type?.charAt(0).toUpperCase() + selectedEncounter.structuredData.diagnosisInfo.type?.slice(1) || 'Diagnosis'}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{selectedEncounter.structuredData.diagnosisInfo.diagnosis}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Fallback: Show notes if no structured data */}
                  {selectedEncounter.notes && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Consultation Notes
                      </label>
                      <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg min-h-[120px]">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {selectedEncounter.notes}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Diagnosis */}
                  {selectedEncounter.diagnosis && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Diagnosis
                      </label>
                      <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg">
                        <p className="text-sm text-gray-800 font-medium">{selectedEncounter.diagnosis}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  onClick={() => setSelectedEncounter(null)}
                  className="px-6 py-2.5 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Details Modal */}
      {selectedClinicalNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedClinicalNote(null);
          }
        }}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-olive-600" />
                <h2 className="text-xl font-bold text-gray-900">Clinical Note Details</h2>
              </div>
              <button
                onClick={() => setSelectedClinicalNote(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Note Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Note Title
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700">
                  {selectedClinicalNote.conceptName || selectedClinicalNote.conceptDisplay || selectedClinicalNote.concept?.display || 'Clinical Note'}
                </div>
              </div>

              {/* Note Content */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Note Content
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg min-h-[120px]">
                  {selectedClinicalNote.value || selectedClinicalNote.valueText ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedClinicalNote.value || selectedClinicalNote.valueText}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No content available</p>
                  )}
                </div>
              </div>

              {/* Images */}
              {(() => {
                const metadata = selectedClinicalNote.metadata;
                const images = metadata?.images || [];
                if (images.length > 0) {
                  return (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Images ({images.length})
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {images.map((imageUrl: string, index: number) => (
                          <div key={index} className="relative group">
                            <img
                              src={imageUrl}
                              alt={`Note image ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg border border-gray-100"
                            />
                            <a
                              href={imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg"
                            >
                              <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">View Full Size</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Files */}
              {(() => {
                const metadata = selectedClinicalNote.metadata;
                const files = metadata?.files || [];
                if (files.length > 0) {
                  return (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Attachments ({files.length})
                      </label>
                      <div className="space-y-2">
                        {files.map((file: { name: string; url: string }, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <FileIcon className="h-5 w-5 text-gray-500" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              </div>
                            </div>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-olive-500 hover:bg-olive-600 text-white text-xs font-medium rounded-xl transition-colors"
                            >
                              Download
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Date */}
              {(() => {
                const getNoteDate = () => {
                  if (selectedClinicalNote.obsDatetime?.toDate) return selectedClinicalNote.obsDatetime.toDate();
                  if (selectedClinicalNote.observationDate?.toDate) return selectedClinicalNote.observationDate.toDate();
                  if (selectedClinicalNote.createdAt?.toDate) return selectedClinicalNote.createdAt.toDate();
                  if (selectedClinicalNote.obsDatetime) return new Date(selectedClinicalNote.obsDatetime);
                  if (selectedClinicalNote.observationDate) return new Date(selectedClinicalNote.observationDate);
                  if (selectedClinicalNote.createdAt) return new Date(selectedClinicalNote.createdAt);
                  return null;
                };
                const noteDate = getNoteDate();
                const isValidDate = noteDate && !isNaN(noteDate.getTime());
                
                if (isValidDate) {
                  return (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Recorded Date
                      </label>
                      <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700">
                        {formatDate(noteDate.toISOString())} at {noteDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Actions */}
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  onClick={() => setSelectedClinicalNote(null)}
                  className="px-6 py-2.5 bg-olive-500 hover:bg-olive-600 text-white font-medium rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ask Hope - AI Clinical Assistant (Admin/Physician only) */}
      {isAdminView && patientData && (
        <AskHope
          patientId={getPatientUuid(patientData.patient)}
          patientName={getPatientName(patientData.patient)}
          onOpenChange={setAskHopeOpen}
        />
      )}
    </div>
  )
}

export default SimpleDashboard
