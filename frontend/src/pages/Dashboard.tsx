import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Button,
  Chip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Person,
  LocalHospital,
  Science,
  Medication,
  CalendarToday,
  TrendingUp,

  CheckCircle,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api.service';
import { FHIRObservation, FHIRMedicationRequest, Encounter } from '../types';

const Dashboard: React.FC = () => {
  const { patient } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [recentLabResults, setRecentLabResults] = useState<FHIRObservation[]>([]);
  const [currentMedications, setCurrentMedications] = useState<FHIRMedicationRequest[]>([]);
  const [recentEncounters, setRecentEncounters] = useState<Encounter[]>([]);
  const [vitalSigns, setVitalSigns] = useState<FHIRObservation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      loadDashboardData();
    }
  }, [patient]);

  const loadDashboardData = async () => {
    if (!patient) return;

    try {
      setLoading(true);
      setError(null);

      // Load data in parallel
      const [
        labResults,
        medications,
        encounters,
        vitals,
      ] = await Promise.allSettled([
        apiService.getLabResults(patient.uuid),
        apiService.getFHIRMedicationRequests(patient.uuid),
        apiService.getPatientEncounters(patient.uuid),
        apiService.getVitalSigns(patient.uuid),
      ]);

      // Handle lab results
      if (labResults.status === 'fulfilled') {
        setRecentLabResults(labResults.value.slice(0, 3)); // Last 3 results
      }

      // Handle medications
      if (medications.status === 'fulfilled') {
        const activeMeds = medications.value.filter(med => 
          med.status === 'active' || med.status === 'on-hold'
        );
        setCurrentMedications(activeMeds.slice(0, 5)); // Top 5 current meds
      }

      // Handle encounters
      if (encounters.status === 'fulfilled') {
        setRecentEncounters(encounters.value.slice(0, 3)); // Last 3 visits
      }

      // Handle vital signs
      if (vitals.status === 'fulfilled') {
        setVitalSigns(vitals.value.slice(0, 4)); // Recent vitals
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setError('Failed to load some dashboard information. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatObservationValue = (obs: FHIRObservation) => {
    if (obs.valueQuantity) {
      return `${obs.valueQuantity.value} ${obs.valueQuantity.unit}`;
    }
    if (obs.valueString) {
      return obs.valueString;
    }
    if (obs.valueCodableConcept) {
      return obs.valueCodableConcept.coding[0]?.display || 'N/A';
    }
    return 'N/A';
  };

  if (!patient) {
    return (
      <Alert severity="warning">
        No patient profile found. Please contact the clinic to link your account.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading your health information...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Welcome Section */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #0365AC 0%, #4A8BC2 100%)', color: 'white' }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(255,255,255,0.2)' }}>
                <Person fontSize="large" />
              </Avatar>
            </Grid>
            <Grid item xs>
              <Typography variant="h4" gutterBottom>
                Welcome, {patient.person.preferredName.givenName}!
              </Typography>
              <Typography variant="body1">
                Patient ID: {patient.identifiers[0]?.identifier || 'N/A'}
              </Typography>
              <Typography variant="body2">
                Last updated: {formatDate(new Date().toISOString())}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <LocalHospital color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{recentEncounters.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Recent Visits
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Science color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{recentLabResults.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Recent Lab Results
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Medication color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{currentMedications.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current Medications
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingUp color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{vitalSigns.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Vital Signs Recorded
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Recent Lab Results */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Recent Lab Results</Typography>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => navigate('/lab-results')}
                >
                  View All
                </Button>
              </Box>
              
              {recentLabResults.length > 0 ? (
                <List>
                  {recentLabResults.map((result, index) => (
                    <React.Fragment key={result.id}>
                      <ListItem>
                        <ListItemIcon>
                          <Science color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={result.code.coding[0]?.display || 'Lab Test'}
                          secondary={`${formatObservationValue(result)} - ${formatDate(result.effectiveDateTime)}`}
                        />
                        <Chip
                          label="Normal"
                          color="success"
                          size="small"
                          icon={<CheckCircle />}
                        />
                      </ListItem>
                      {index < recentLabResults.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent lab results available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Current Medications */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Current Medications</Typography>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => navigate('/medications')}
                >
                  View All
                </Button>
              </Box>
              
              {currentMedications.length > 0 ? (
                <List>
                  {currentMedications.map((medication, index) => (
                    <React.Fragment key={medication.id}>
                      <ListItem>
                        <ListItemIcon>
                          <Medication color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={medication.medicationCodeableConcept.coding[0]?.display || 'Medication'}
                          secondary={medication.dosageInstruction[0]?.text || 'As prescribed'}
                        />
                        <Chip
                          label={medication.status}
                          color={medication.status === 'active' ? 'success' : 'warning'}
                          size="small"
                        />
                      </ListItem>
                      {index < currentMedications.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No current medications on record
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Visits */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Recent Visits</Typography>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => navigate('/records')}
                >
                  View All
                </Button>
              </Box>
              
              {recentEncounters.length > 0 ? (
                <List>
                  {recentEncounters.map((encounter, index) => (
                    <React.Fragment key={encounter.uuid}>
                      <ListItem>
                        <ListItemIcon>
                          <LocalHospital color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={encounter.encounterType.display}
                          secondary={`${encounter.location.display} - ${formatDate(encounter.encounterDatetime)}`}
                        />
                      </ListItem>
                      {index < recentEncounters.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent visits on record
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Vital Signs */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Latest Vital Signs
              </Typography>
              
              {vitalSigns.length > 0 ? (
                <List>
                  {vitalSigns.map((vital, index) => (
                    <React.Fragment key={vital.id}>
                      <ListItem>
                        <ListItemIcon>
                          <TrendingUp color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={vital.code.coding[0]?.display || 'Vital Sign'}
                          secondary={`${formatObservationValue(vital)} - ${formatDate(vital.effectiveDateTime)}`}
                        />
                      </ListItem>
                      {index < vitalSigns.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No vital signs recorded recently
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            <Grid item>
              <Button
                variant="contained"
                startIcon={<CalendarToday />}
                onClick={() => navigate('/appointments')}
              >
                View Appointments
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<Person />}
                onClick={() => navigate('/profile')}
              >
                Update Profile
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<Science />}
                onClick={() => navigate('/lab-results')}
              >
                Download Lab Results
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Dashboard;
