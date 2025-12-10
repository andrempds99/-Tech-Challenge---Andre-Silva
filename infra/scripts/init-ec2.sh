#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# EC2 Initialization Script
# ============================================================================
# Installs Docker and AWS CLI v2 on a fresh EC2 instance
#
# This script:
#   1. Installs Docker Engine
#   2. Installs AWS CLI v2
#   3. Verifies installations
#
# Usage:
#   bash infra/scripts/init-ec2.sh
#
# Note: After running, you may need to log out and back in for Docker
#       group membership to take effect.
# ============================================================================

echo "=========================================="
echo "Initializing EC2 Instance"
echo "=========================================="
echo ""

# Install Docker
echo "Installing Docker..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Add current user to docker group
sudo usermod -aG docker "$USER"

echo "Docker installed successfully."
echo "Note: You may need to log out and back in for Docker group membership to take effect."
echo ""

# Install AWS CLI v2
if ! command -v aws &> /dev/null; then
  echo "Installing AWS CLI v2..."
  cd /tmp
  curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
  unzip -q awscliv2.zip
  sudo ./aws/install
  rm -rf aws awscliv2.zip
  echo "AWS CLI v2 installed successfully."
else
  echo "AWS CLI is already installed (version: $(aws --version 2>&1 | cut -d' ' -f1))."
fi

echo ""
echo "=========================================="
echo "Verifying installations..."
echo "=========================================="
docker --version
aws --version

echo ""
echo "=========================================="
echo "Initialization complete!"
echo "=========================================="
echo ""

# Optionally set up environment file
if [ ! -f ~/assimetria-challenge.env ]; then
  echo "Would you like to set up the environment file now? (y/n)"
  read -r SETUP_ENV
  if [ "$SETUP_ENV" = "y" ] || [ "$SETUP_ENV" = "Y" ]; then
    echo ""
    echo "=========================================="
    echo "Setting up environment configuration"
    echo "=========================================="
    echo ""

    # Get AWS account ID and region
    echo "Detecting AWS account information..."
    if command -v aws &> /dev/null; then
      AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
      AWS_REGION=$(aws configure get region 2>/dev/null || echo "")
    else
      AWS_ACCOUNT_ID=""
      AWS_REGION=""
    fi

    # Get EC2 public IP
    EC2_PUBLIC_IP=$(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")

    echo "Detected values (if available):"
    echo "  AWS Account ID: ${AWS_ACCOUNT_ID:-<not detected>}"
    echo "  AWS Region: ${AWS_REGION:-<not detected>}"
    echo "  EC2 Public IP: ${EC2_PUBLIC_IP:-<not detected>}"
    echo ""

    # Prompt for values
    read -p "AWS Account ID [${AWS_ACCOUNT_ID}]: " INPUT_ACCOUNT_ID
    AWS_ACCOUNT_ID=${INPUT_ACCOUNT_ID:-$AWS_ACCOUNT_ID}

    read -p "AWS Region [${AWS_REGION:-us-east-1}]: " INPUT_REGION
    AWS_REGION=${INPUT_REGION:-${AWS_REGION:-us-east-1}}

    read -p "EC2 Public IP [${EC2_PUBLIC_IP}]: " INPUT_PUBLIC_IP
    EC2_PUBLIC_IP=${INPUT_PUBLIC_IP:-$EC2_PUBLIC_IP}

    read -p "OpenRouter API Key: " OPENROUTER_API_KEY
    if [ -z "$OPENROUTER_API_KEY" ]; then
      echo "Error: OpenRouter API Key is required"
      exit 1
    fi

    read -p "AI Model [meta-llama/llama-3.2-3b-instruct:free]: " AI_MODEL
    AI_MODEL=${AI_MODEL:-meta-llama/llama-3.2-3b-instruct:free}

    read -p "Cron Schedule [0 3 * * *]: " CRON_SCHEDULE
    CRON_SCHEDULE=${CRON_SCHEDULE:-0 3 * * *}

    # Validate inputs
    if [ -z "$AWS_ACCOUNT_ID" ] || [ -z "$AWS_REGION" ] || [ -z "$EC2_PUBLIC_IP" ]; then
      echo "Error: Missing required values (AWS Account ID, Region, or EC2 Public IP)"
      exit 1
    fi

    # Create ECR registry and URLs
    ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    VITE_API_URL="http://${EC2_PUBLIC_IP}:4000/api"
    ALLOWED_ORIGIN="http://${EC2_PUBLIC_IP}"

    # Create environment file
    ENV_FILE="$HOME/assimetria-challenge.env"

    cat > "$ENV_FILE" << EOF
# ECR Configuration
export ECR_REGISTRY="${ECR_REGISTRY}"
export FRONTEND_REPO="assimetria-challenge-frontend"
export BACKEND_REPO="assimetria-challenge-backend"

# Backend Environment
export OPENROUTER_API_KEY="${OPENROUTER_API_KEY}"
export AI_MODEL="${AI_MODEL}"
export CRON_SCHEDULE="${CRON_SCHEDULE}"
export PORT="4000"
export ALLOWED_ORIGIN="${ALLOWED_ORIGIN}"

# Frontend Environment
export VITE_API_URL="${VITE_API_URL}"
EOF

    echo ""
    echo "Environment file created: $ENV_FILE"
    echo ""
  fi
fi

echo "Next steps:"
echo "  1. Log out and back in (or run: newgrp docker) for Docker group membership"
if [ ! -f ~/assimetria-challenge.env ]; then
  echo "  2. Run: bash infra/scripts/setup-ec2-env.sh (or set up environment manually)"
  echo "  3. Run: source ~/assimetria-challenge.env && bash infra/scripts/deploy.sh"
else
  echo "  2. Run: source ~/assimetria-challenge.env && bash infra/scripts/deploy.sh"
fi
echo ""
