#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Deployment Script
# ============================================================================
# Deploys the Assimetria Challenge application on EC2
#
# Required Environment Variables:
#   ECR_REGISTRY - ECR registry URL (e.g., 211269420082.dkr.ecr.eu-west-3.amazonaws.com)
#   OPENROUTER_API_KEY - OpenRouter API key
#
# Optional Environment Variables:
#   FRONTEND_REPO - Frontend repository name (default: assimetria-challenge-frontend)
#   BACKEND_REPO - Backend repository name (default: assimetria-challenge-backend)
#   VITE_API_URL - Frontend API URL (default: http://localhost:4000/api)
#   AI_MODEL - AI model to use (default: meta-llama/llama-3.2-3b-instruct:free)
#   CRON_SCHEDULE - Cron schedule for article generation (default: 0 3 * * *)
#   ALLOWED_ORIGIN - CORS allowed origin (default: *)
#
# Usage:
#   source ~/assimetria-challenge.env
#   bash infra/scripts/deploy.sh
# ============================================================================

# Load environment file if it exists
if [ -f ~/assimetria-challenge.env ]; then
  echo "Loading environment from ~/assimetria-challenge.env..."
  source ~/assimetria-challenge.env
fi

# Validate required variables
ECR_REGISTRY="${ECR_REGISTRY:?Error: ECR_REGISTRY must be set}"
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:?Error: OPENROUTER_API_KEY must be set}"

# Set defaults
FRONTEND_REPO="${FRONTEND_REPO:-assimetria-challenge-frontend}"
BACKEND_REPO="${BACKEND_REPO:-assimetria-challenge-backend}"
AI_MODEL="${AI_MODEL:-meta-llama/llama-3.2-3b-instruct:free}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"

# Auto-detect EC2 IP if VITE_API_URL is not set or is localhost
if [ -z "${VITE_API_URL:-}" ] || [ "$VITE_API_URL" = "http://localhost:4000/api" ]; then
  echo "Auto-detecting EC2 IP address..."
  EC2_IP=$(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
  if [ -n "$EC2_IP" ]; then
    VITE_API_URL="http://${EC2_IP}:4000/api"
    ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-http://${EC2_IP}}"
    echo "Detected EC2 IP: $EC2_IP"
  else
    VITE_API_URL="${VITE_API_URL:-http://localhost:4000/api}"
    ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-*}"
    echo "Could not detect EC2 IP, using localhost"
  fi
else
  # Extract IP from VITE_API_URL if ALLOWED_ORIGIN is not set
  if [ -z "${ALLOWED_ORIGIN:-}" ] || [ "$ALLOWED_ORIGIN" = "*" ]; then
    EC2_IP=$(echo "$VITE_API_URL" | sed -n 's|http://\([^:]*\):.*|\1|p')
    if [ -n "$EC2_IP" ] && [ "$EC2_IP" != "localhost" ]; then
      ALLOWED_ORIGIN="http://${EC2_IP}"
    else
      ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-*}"
    fi
  fi
fi

# Extract AWS region from ECR registry if not set
if [ -z "${AWS_REGION:-}" ]; then
  AWS_REGION=$(echo "$ECR_REGISTRY" | sed -n 's/.*\.ecr\.\([^.]*\)\.amazonaws\.com.*/\1/p')
  AWS_REGION="${AWS_REGION:-eu-west-3}"
fi

echo "=========================================="
echo "Deploying Assimetria Challenge"
echo "=========================================="
echo "ECR Registry: $ECR_REGISTRY"
echo "Frontend Repo: $FRONTEND_REPO"
echo "Backend Repo: $BACKEND_REPO"
echo "API URL: $VITE_API_URL"
echo ""

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY" || {
  echo "Warning: ECR login failed. Continuing anyway..."
}

# Pull backend image
echo "Pulling backend image..."
docker pull "$ECR_REGISTRY/$BACKEND_REPO:latest" || {
  echo "Error: Failed to pull backend image"
  exit 1
}

# Rebuild frontend with correct API URL
echo "Rebuilding frontend with VITE_API_URL=$VITE_API_URL..."
cd "$(dirname "$0")/../.."
docker build \
  --build-arg VITE_API_URL="$VITE_API_URL" \
  -t "$ECR_REGISTRY/$FRONTEND_REPO:latest" \
  ./frontend || {
  echo "Error: Failed to build frontend image"
  exit 1
}

# Stop and remove existing containers
echo "Stopping existing containers..."
docker stop assimetria-challenge-backend assimetria-challenge-frontend 2>/dev/null || true
docker rm assimetria-challenge-backend assimetria-challenge-frontend 2>/dev/null || true

# Start backend container
echo "Starting backend container..."
docker run -d --restart unless-stopped --name assimetria-challenge-backend \
  -p 4000:4000 \
  -e PORT=4000 \
  -e OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
  -e AI_MODEL="$AI_MODEL" \
  -e OPENROUTER_TIMEOUT_MS="${OPENROUTER_TIMEOUT_MS:-30000}" \
  -e OPENROUTER_MAX_TOKENS="${OPENROUTER_MAX_TOKENS:-500}" \
  -e OPENROUTER_TEMPERATURE="${OPENROUTER_TEMPERATURE:-0.7}" \
  -e CRON_SCHEDULE="$CRON_SCHEDULE" \
  -e ALLOWED_ORIGIN="$ALLOWED_ORIGIN" \
  -v /opt/assimetria-challenge/data:/app/data \
  "$ECR_REGISTRY/$BACKEND_REPO:latest" || {
  echo "Error: Failed to start backend container"
  exit 1
}

# Start frontend container
echo "Starting frontend container..."
docker run -d --restart unless-stopped --name assimetria-challenge-frontend \
  -p 80:4173 \
  "$ECR_REGISTRY/$FRONTEND_REPO:latest" || {
  echo "Error: Failed to start frontend container"
  exit 1
}

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="

# Extract IP from VITE_API_URL for display
DISPLAY_IP=$(echo "$VITE_API_URL" | sed -n 's|http://\([^:]*\):.*|\1|p')
if [ -n "$DISPLAY_IP" ] && [ "$DISPLAY_IP" != "localhost" ]; then
  echo "Backend: http://${DISPLAY_IP}:4000"
  echo "Backend API: http://${DISPLAY_IP}:4000/api"
  echo "Backend Health: http://${DISPLAY_IP}:4000/health"
  echo "Frontend: http://${DISPLAY_IP}"
else
  echo "Backend: http://localhost:4000"
  echo "Frontend: http://localhost"
fi

echo ""
echo "Container status:"
docker ps --filter "name=assimetria-challenge" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No containers found"
echo ""
