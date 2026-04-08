# Initialization Scripts

This directory contains scripts to initialize Firestore collections with default data.

## Initialize Diagnosis Concepts

This script populates the `diagnosisConcepts` collection in Firestore with common medical diagnoses.

### Quick Start (Recommended)

```bash
npm run init-diagnoses
```

Or directly:

```bash
node scripts/initializeDiagnosesClient.js
```

### What It Does

- Checks if the `diagnosisConcepts` collection already has data
- If empty, adds 40 common diagnoses to Firestore
- If data exists, skips initialization (prevents duplicates)

### Diagnoses Included

The script initializes the following diagnoses:
- Malaria
- Typhoid Fever
- Upper Respiratory Tract Infection
- Hypertension
- Diabetes Mellitus Type 2
- Gastroenteritis
- Pneumonia
- Urinary Tract Infection
- Tuberculosis
- HIV/AIDS
- And 30 more common diagnoses...

### Troubleshooting

**Error: Cannot find module 'firebase'**
```bash
npm install firebase
```

**Error: Permission denied**
- Ensure your Firebase project has Firestore enabled
- Check that you have write permissions for the Firestore database
- Verify your Firebase configuration in the script matches your project

**Want to reinitialize?**
- Delete the `diagnosisConcepts` collection from Firestore Console
- Then run the script again

### Alternative: Firebase Admin SDK

If you prefer using Firebase Admin SDK (better for server-side scripts):

1. Install Firebase Admin:
```bash
npm install firebase-admin
```

2. Set up credentials:
   - Option A: Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
   - Option B: Place `serviceAccountKey.json` in project root

3. Run:
```bash
node scripts/initializeDiagnoses.js
```

### Notes

- The script uses batch writes for efficiency (up to 500 operations per batch)
- It's safe to run multiple times - it won't create duplicates
- The script connects to your production Firestore (configured in `src/services/firebase.ts`)
