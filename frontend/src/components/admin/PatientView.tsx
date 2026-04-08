import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Divider,
  Stack,
  Avatar,
  Button,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  User,
  Calendar,
  MapPin,
  Phone,
  Heart,
  Activity,
  Pill,
  TestTube,
  FileText,
  Plus,
  Stethoscope,
} from 'lucide-react';
import { patientDataService, type CompletePatientData } from '../../services/patientDataService';
import VitalsForm from './VitalsForm';
import ConsultationForm from './ConsultationForm';

interface PatientViewProps {
  patientUuid: string;
}

export default function PatientView({ patientUuid }: PatientViewProps) {
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<CompletePatientData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showConsultationForm, setShowConsultationForm] = useState(false);

  useEffect(() => {
    if (patientUuid) {
      loadPatientData();
    }
  }, [patientUuid]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      setError(null);
      const completeData = await patientDataService.getCompletePatientData(patientUuid);
      setPatientData(completeData);
    } catch (error) {
      console.error('Failed to load patient data:', error);
      setError('Failed to load patient information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleOpenVitalsForm = () => {
    setShowVitalsForm(true);
    handleMenuClose();
  };

  const handleOpenConsultationForm = () => {
    setShowConsultationForm(true);
    handleMenuClose();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !patientData) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error || 'Patient data not found'}
      </Alert>
    );
  }

  const { patient, vitals = [], medications = [], labResults = [], encounters = [] } = patientData || {};

  if (!patient) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Patient data not found
      </Alert>
    );
  }

  return (
    <Box>
      {/* Patient Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={3}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: 'primary.main',
                fontSize: '2rem',
                fontWeight: 700,
              }}
            >
              {patient.person?.preferredName?.givenName?.[0] || '?'}
              {patient.person?.preferredName?.familyName?.[0] || '?'}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                {patient.person.preferredName.display}
              </Typography>
              <Grid container spacing={2}>
                <Grid item>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Calendar size={16} />
                    <Typography variant="body2" color="text.secondary">
                      {getAge(patient.person.birthdate)} years old
                    </Typography>
                  </Box>
                </Grid>
                <Grid item>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <User size={16} />
                    <Typography variant="body2" color="text.secondary">
                      {patient.person.gender.toUpperCase()}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <FileText size={16} />
                    <Typography variant="body2" color="text.secondary">
                      ID: {patient.identifiers[0]?.identifier || 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                label={patient.person.dead ? 'Deceased' : 'Active'}
                color={patient.person.dead ? 'error' : 'success'}
                sx={{ fontWeight: 600 }}
              />
              <Button
                variant="contained"
                color="primary"
                startIcon={<Plus size={18} />}
                onClick={handleMenuOpen}
                sx={{ fontWeight: 600 }}
              >
                Add Visit
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleOpenVitalsForm}>
                  <Activity size={16} style={{ marginRight: 8 }} />
                  Record Vitals
                </MenuItem>
                <MenuItem onClick={handleOpenConsultationForm}>
                  <Stethoscope size={16} style={{ marginRight: 8 }} />
                  New Consultation
                </MenuItem>
              </Menu>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Contact Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Phone size={20} />
                Contact Information
              </Typography>
              <Stack spacing={2}>
                {(patient.person?.attributes || [])
                  .filter((attr) =>
                    attr.attributeType?.display?.toLowerCase().includes('phone') ||
                    attr.attributeType?.display?.toLowerCase().includes('telephone')
                  )
                  .map((attr) => (
                    <Box key={attr.uuid}>
                      <Typography variant="body2" color="text.secondary">
                        {attr.attributeType.display}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {attr.value}
                      </Typography>
                    </Box>
                  ))}
                {patient.person.preferredAddress && (
                  <Box>
                    <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                      <MapPin size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Address
                      </Typography>
                    </Box>
                    <Typography variant="body1">
                      {[
                        patient.person.preferredAddress.address1,
                        patient.person.preferredAddress.address2,
                        patient.person.preferredAddress.cityVillage,
                        patient.person.preferredAddress.stateProvince,
                        patient.person.preferredAddress.country,
                        patient.person.preferredAddress.postalCode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Vital Signs */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Activity size={20} />
                Latest Vital Signs
              </Typography>
              {vitals.length > 0 ? (
                <Grid container spacing={2}>
                  {vitals.slice(0, 4).map((vital, index) => (
                    <Grid item xs={6} key={index}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {vital.display}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {typeof vital.value === 'object' ? vital.value.display : vital.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(vital.obsDatetime)}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No vital signs recorded
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Medications */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Pill size={20} />
                Current Medications
              </Typography>
              {medications.length > 0 ? (
                <Stack spacing={2}>
                  {medications.map((med, index) => (
                    <Box key={index}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {med.medicationCodeableConcept.coding[0]?.display || 'Unknown'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {med.dosageInstruction?.[0]?.text || 'No dosage information'}
                      </Typography>
                      <Chip
                        label={med.status}
                        size="small"
                        color={med.status === 'active' ? 'success' : 'default'}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active medications
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Lab Results */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TestTube size={20} />
                Recent Lab Results
              </Typography>
              {labResults.length > 0 ? (
                <Stack spacing={2}>
                  {labResults.slice(0, 5).map((lab, index) => (
                    <Box key={index}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {lab.code.coding[0]?.display || 'Unknown Test'}
                      </Typography>
                      <Typography variant="body2">
                        {lab.valueQuantity
                          ? `${lab.valueQuantity.value} ${lab.valueQuantity.unit}`
                          : lab.valueString || 'No value'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(lab.effectiveDateTime)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No lab results available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Encounters */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Heart size={20} />
                Recent Encounters
              </Typography>
              {encounters.length > 0 ? (
                <Stack spacing={2}>
                  {encounters.slice(0, 5).map((encounter, index) => (
                    <Box key={index}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Type
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {encounter.encounterType.display}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Date
                          </Typography>
                          <Typography variant="body1">
                            {formatDate(encounter.encounterDatetime)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Location
                          </Typography>
                          <Typography variant="body1">
                            {encounter.location.display}
                          </Typography>
                        </Grid>
                      </Grid>
                      {index < encounters.length - 1 && <Divider sx={{ mt: 2 }} />}
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent encounters
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Vitals Form Modal */}
      {showVitalsForm && (
        <VitalsForm
          patientUuid={patientUuid}
          patientName={patient.person.preferredName.display}
          onClose={() => setShowVitalsForm(false)}
          onSuccess={() => {
            setShowVitalsForm(false);
            loadPatientData(); // Reload patient data to show new vitals
          }}
        />
      )}

      {/* Consultation Form Modal */}
      {showConsultationForm && (
        <ConsultationForm
          patientUuid={patientUuid}
          patientName={patient.person.preferredName.display}
          onClose={() => setShowConsultationForm(false)}
          onSuccess={() => {
            setShowConsultationForm(false);
            loadPatientData(); // Reload patient data to show new encounter
          }}
        />
      )}
    </Box>
  );
}
