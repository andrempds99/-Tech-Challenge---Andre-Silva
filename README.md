# Assimetria Technical Challenge

Full-stack auto-generated blog application built for AWS deployment. This project demonstrates end-to-end development and deployment of a React frontend, Node.js backend, and AI-powered content generation system.

## Overview

Technical challenge submission implementing:
- React frontend with article listing and detail views
- Node.js/Express backend API
- SQLite database for article persistence
- OpenRouter free-tier AI integration for article generation
- Automated daily article generation via cron scheduling
- Docker containerization for both frontend and backend
- AWS deployment pipeline (EC2, ECR, CodeBuild)

## Architecture

- **Frontend**: React 18 with Vite, served on port 4173
- **Backend**: Express.js API on port 4000
- **Database**: SQLite3 (persistent storage)
- **AI Service**: OpenRouter API with free-tier models
- **Automation**: Daily article generation via node-cron (configurable schedule)

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- OpenRouter API key (free-tier)

## Local Development

1. Clone the repository
2. Configure environment variables:
   - Copy `backend/env.example` to `backend/.env`
   - Set `OPENROUTER_API_KEY`
3. Start services:
   ```bash
   cd infra
   docker-compose up -d
   ```

Access:
- Frontend: http://localhost:4173
- Backend API: http://localhost:4000/api
- Health check: http://localhost:4000/health

## Configuration

### Backend Environment Variables

- `PORT`: Server port (default: 4000)
- `OPENROUTER_API_KEY`: Required for AI generation
- `AI_MODEL`: Model identifier (default: meta-llama/llama-3.2-3b-instruct:free)
- `CRON_SCHEDULE`: Article generation schedule (default: 0 3 * * *)

See `backend/env.example` for complete configuration.

### Frontend Environment Variables

- `VITE_API_URL`: Backend API URL (default: http://localhost:4000/api)

## API Endpoints

- `GET /api/articles` - List all articles
- `GET /api/articles/:id` - Get article by ID
- `POST /api/articles/generate` - Generate new article manually
- `GET /api/articles/diagnostics/ai` - AI connection diagnostics
- `GET /health` - Health check with database connectivity

## AWS Deployment

Deployment infrastructure:
- **EC2**: Ubuntu instance hosting Docker containers
- **ECR**: Container image registry
- **CodeBuild**: CI/CD pipeline for automated builds

Deployment flow:
1. Code pushed to GitHub
2. CodeBuild triggers, builds Docker images
3. Images pushed to ECR
4. EC2 instance pulls and runs latest images

Configuration files in `infra/`:
- `buildspec.yml` - CodeBuild configuration
- `docker-compose.yml` - Container orchestration
- `scripts/` - Deployment automation scripts

## Automation

The system automatically generates one new article per day using the configured cron schedule. The database is initialized with at least 3 sample articles on first run.

## Documentation

Detailed architecture documentation: `docs/ARCHITECTURE.md`

