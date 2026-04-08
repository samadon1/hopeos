#!/bin/bash
# HopeOS Backend - Cloud Run Deployment Script

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-hopeos-prod}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="hopeos-api"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "=========================================="
echo "HopeOS Backend - Cloud Run Deployment"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 > /dev/null 2>&1; then
    echo "Not logged in to gcloud. Running 'gcloud auth login'..."
    gcloud auth login
fi

# Set project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com

# Build and push the image
echo "Building and pushing Docker image..."
gcloud builds submit --tag $IMAGE_NAME .

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --port 8080 \
    --set-env-vars "DATABASE_URL=sqlite+aiosqlite:///./hopeos.db" \
    --set-env-vars "JWT_SECRET_KEY=$(openssl rand -hex 32)" \
    --set-env-vars "CORS_ORIGINS=*" \
    --set-env-vars "AI_AUTO_DOWNLOAD=false" \
    --set-env-vars "AI_PRELOAD=false"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo "API URL: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "1. Update your frontend VITE_API_URL to: $SERVICE_URL/api"
echo "2. For production, set up Cloud SQL (Postgres) instead of SQLite"
echo "3. Add ANTHROPIC_API_KEY or OPENAI_API_KEY for AI features"
