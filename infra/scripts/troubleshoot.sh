#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Troubleshooting Script
# ============================================================================
# Diagnostic script to check the status of the Assimetria Challenge deployment
#
# This script checks:
#   1. Docker container status
#   2. Container logs
#   3. Port availability
#   4. Health endpoints
#   5. Environment variables
#   6. Database directory
#   7. Docker networks
#
# Usage:
#   bash infra/scripts/troubleshoot.sh
# ============================================================================

echo "=========================================="
echo "Assimetria Challenge Troubleshooting"
echo "=========================================="
echo ""

# Determine if sudo is needed for docker
DOCKER_CMD="docker"
if ! docker ps >/dev/null 2>&1; then
  DOCKER_CMD="sudo docker"
fi

# 1. Check Docker containers status
echo "1. Checking Docker containers status..."
$DOCKER_CMD ps -a --filter "name=assimetria-challenge" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || echo "No containers found"
echo ""

# 2. Check backend container logs
echo "2. Checking backend container logs (last 50 lines)..."
if $DOCKER_CMD ps -a --format "{{.Names}}" | grep -q assimetria-challenge-backend; then
  echo "--- Backend logs ---"
  $DOCKER_CMD logs --tail 50 assimetria-challenge-backend 2>&1 || echo "Failed to get logs"
else
  echo "Backend container not found"
fi
echo ""

# 3. Check frontend container logs
echo "3. Checking frontend container logs (last 50 lines)..."
if $DOCKER_CMD ps -a --format "{{.Names}}" | grep -q assimetria-challenge-frontend; then
  echo "--- Frontend logs ---"
  $DOCKER_CMD logs --tail 50 assimetria-challenge-frontend 2>&1 || echo "Failed to get logs"
else
  echo "Frontend container not found"
fi
echo ""

# 4. Check if backend port 4000 is listening
echo "4. Checking if backend port 4000 is listening..."
if command -v netstat &> /dev/null; then
  netstat -tlnp 2>/dev/null | grep :4000 || echo "Port 4000 not listening"
elif command -v ss &> /dev/null; then
  ss -tlnp 2>/dev/null | grep :4000 || echo "Port 4000 not listening"
else
  echo "Cannot check port (netstat/ss not available)"
fi
echo ""

# 5. Test backend health endpoint
echo "5. Testing backend health endpoint locally..."
curl -s --max-time 5 http://localhost:4000/health || echo "Failed to connect to backend"
echo ""

# 6. Check environment variables
echo "6. Checking environment variables..."
if [ -f ~/assimetria-challenge.env ]; then
  echo "Environment file exists at ~/assimetria-challenge.env"
  echo "Checking if required vars are set..."
  source ~/assimetria-challenge.env 2>/dev/null || true
  [ -z "${OPENROUTER_API_KEY:-}" ] && echo "WARNING: OPENROUTER_API_KEY not set"
  [ -z "${ECR_REGISTRY:-}" ] && echo "WARNING: ECR_REGISTRY not set"
  [ -z "${VITE_API_URL:-}" ] && echo "WARNING: VITE_API_URL not set"
else
  echo "WARNING: Environment file not found at ~/assimetria-challenge.env"
fi
echo ""

# 7. Check database directory permissions
echo "7. Checking database directory permissions..."
if [ -d /opt/assimetria-challenge/data ]; then
  ls -la /opt/assimetria-challenge/data | head -5
  if [ ! -w /opt/assimetria-challenge/data ]; then
    echo "WARNING: Database directory is not writable"
  fi
else
  echo "WARNING: Database directory /opt/assimetria-challenge/data does not exist"
  echo "Creating directory..."
  sudo mkdir -p /opt/assimetria-challenge/data
  sudo chmod 755 /opt/assimetria-challenge/data
fi
echo ""

# 8. Check Docker network connectivity
echo "8. Checking Docker network connectivity..."
$DOCKER_CMD network ls
echo ""

# 9. Check Docker system info
echo "9. Checking Docker system information..."
$DOCKER_CMD system df
echo ""

echo "=========================================="
echo "Troubleshooting complete"
echo "=========================================="
echo ""
echo "Common fixes:"
echo "  - If containers are not running:"
echo "    source ~/assimetria-challenge.env && bash infra/scripts/deploy.sh"
echo ""
echo "  - If port 4000 is blocked:"
echo "    Check AWS Security Group allows inbound traffic on port 4000"
echo ""
echo "  - If containers crash:"
echo "    Check logs above for errors"
echo ""
echo "  - If frontend can't connect to backend:"
echo "    bash infra/scripts/fix-frontend-api.sh"
echo ""
