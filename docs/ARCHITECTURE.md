# Architecture Documentation

## System Overview

The Auto-Generated Blog is a full-stack web application that automatically generates and serves blog articles using AI. The system consists of a React frontend, Express.js backend, SQLite database, and integrates with OpenRouter API for article generation. The application is containerized with Docker and designed for deployment on AWS infrastructure.

## Architecture Components

### Frontend

**Technology Stack:**
- React 18.2.0
- Vite 5.0.4
- Axios for HTTP requests

**Structure:**
- Single Page Application (SPA) with client-side routing
- Main component (`App.jsx`) manages article list and detail views
- Static build served via `serve` in production

**Key Features:**
- Article listing sidebar with selection
- Article detail view
- Manual article generation trigger
- Refresh functionality
- Responsive layout

**Build Process:**
- Multi-stage Docker build
- Build-time environment variable injection (`VITE_API_URL`)
- Static assets served on port 4173

### Backend

**Technology Stack:**
- Node.js 18
- Express.js 4.18.2
- SQLite3 5.1.6
- node-cron 3.0.3 for scheduled tasks
- Axios for external API calls

**Structure:**
```
backend/
├── src/
│   ├── index.js          # Server entry point
│   ├── db.js             # Database initialization
│   ├── routes/
│   │   └── articles.js   # Article API endpoints
│   └── services/
│       ├── articleService.js  # Business logic
│       ├── aiClient.js        # OpenRouter integration
│       └── articleJob.js      # Cron scheduler
└── data/
    └── blog.db           # SQLite database
```

**API Endpoints:**
- `GET /api/articles` - List all articles
- `GET /api/articles/:id` - Get article by ID
- `POST /api/articles/generate` - Generate new article
- `GET /api/articles/diagnostics/ai` - AI connection diagnostics
- `GET /health` - Health check with database connectivity

**Database Schema:**
```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Scheduled Jobs:**
- Daily article generation via node-cron
- Default schedule: `0 3 * * *` (3:00 AM daily)
- Configurable via `CRON_SCHEDULE` environment variable

### AI Integration

**Service:** OpenRouter API
**Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
**Format:** OpenAI-compatible chat completions API

**Features:**
- Multi-model fallback support
- Free-tier model compatibility
- Automatic fallback to deterministic templates on API failure
- Token verification and diagnostics
- Configurable model selection via `AI_MODEL` environment variable

**Default Model:** `meta-llama/llama-3.2-3b-instruct:free`

**Fallback Models:**
- `meta-llama/llama-3.1-8b-instruct:free`
- `google/gemini-flash-1.5:free`
- `mistralai/mistral-7b-instruct:free`
- `qwen/qwen-2-7b-instruct:free`

**Article Generation Flow:**
1. Receive topic parameter (defaults to "B2B SaaS and open-source Web3 infrastructure")
2. Build prompt with system instructions
3. Attempt generation with configured model
4. Fallback to alternative free models on failure
5. Parse response to extract title and content
6. Store in database
7. Return article object

**Error Handling:**
- Network timeouts (30s default)
- Rate limit handling (429)
- Authentication errors (401)
- Model availability issues
- Graceful degradation to template-based articles

### Data Layer

**Database:** SQLite3
**Location:** `backend/data/blog.db`
**Persistence:** Volume-mounted in Docker containers

**Operations:**
- Automatic table creation on startup
- Initial seeding with 3 sample articles if empty
- CRUD operations via prepared statements
- Timestamp-based ordering

### Containerization

**Backend Container:**
- Base: `node:18-alpine`
- Production dependencies only
- Exposes port 4000
- Volume mount for database persistence

**Frontend Container:**
- Multi-stage build
- Build stage: compile React application
- Runtime stage: serve static files with `serve`
- Exposes port 4173
- Build-time API URL configuration

**Docker Compose:**
- Local development orchestration
- Environment variable injection
- Volume mounts for data persistence
- Service dependencies

### AWS Deployment Architecture

**Infrastructure Components:**
- EC2: Ubuntu 22.04 instance hosting Docker containers
- ECR: Container image registry for frontend and backend
- CodeBuild: CI/CD pipeline for automated builds

**Deployment Flow:**
1. Code pushed to repository
2. CodeBuild triggered
3. Docker images built
4. Images pushed to ECR
5. EC2 instance pulls latest images
6. Containers restarted with new images

**EC2 Configuration:**
- Docker and Docker Compose installed
- ECR authentication configured
- Container orchestration via deployment scripts
- Security groups configured for HTTP/HTTPS access

**CodeBuild Configuration:**
- Buildspec defines build phases
- ECR login and authentication
- Multi-image build process
- Image tagging and pushing

## Data Flow

### Article Generation Flow

1. **Scheduled Trigger:**
   - Cron job executes at configured schedule
   - Calls `createArticle()` service method

2. **Manual Trigger:**
   - Frontend sends POST to `/api/articles/generate`
   - Backend route handler processes request
   - Calls `createArticle()` service method

3. **AI Generation:**
   - Service calls `generateArticle()` from AI client
   - AI client builds prompt and makes API request
   - Response parsed for title and content
   - Fallback to template if API fails

4. **Storage:**
   - Article inserted into SQLite database
   - Full article object returned with ID and timestamp

5. **Response:**
   - HTTP 201 with article JSON
   - Frontend refreshes article list

### Article Retrieval Flow

1. **List Request:**
   - Frontend requests `/api/articles`
   - Backend queries all articles ordered by date
   - Returns JSON array

2. **Detail Request:**
   - Frontend requests `/api/articles/:id`
   - Backend queries article by ID
   - Returns single article object or 404

3. **Display:**
   - Frontend updates state
   - Article list and detail views render

## Security Considerations

**CORS Configuration:**
- Configurable allowed origins via `ALLOWED_ORIGIN`
- Default: wildcard (`*`) for development

**API Key Management:**
- OpenRouter API key stored in environment variables
- Not exposed to frontend
- Validation on startup

**Database Security:**
- SQLite file permissions
- Prepared statements prevent SQL injection
- No user authentication (single-tenant application)

**Container Security:**
- Minimal base images (Alpine Linux)
- Production dependencies only
- Non-root user execution (where applicable)

## Scalability Considerations

**Current Limitations:**
- Single SQLite database (file-based)
- Single backend instance
- No load balancing
- No caching layer

**Potential Improvements:**
- Migrate to PostgreSQL or MySQL for multi-instance support
- Add Redis for caching
- Implement horizontal scaling with load balancer
- Add CDN for frontend assets
- Implement database connection pooling

## Monitoring and Observability

**Health Checks:**
- `/health` endpoint with database connectivity check
- Returns status and timestamp

**Logging:**
- Console logging for operations
- Error logging with stack traces
- AI generation attempt logging

**Diagnostics:**
- `/api/articles/diagnostics/ai` endpoint
- Tests OpenRouter connection
- Returns API key status, model availability, test results

## Environment Configuration

**Backend Variables:**
- `PORT`: Server port (default: 4000)
- `OPENROUTER_API_KEY`: Required for AI generation
- `AI_MODEL`: Model identifier (default: meta-llama/llama-3.2-3b-instruct:free)
- `CRON_SCHEDULE`: Cron expression (default: 0 3 * * *)
- `ALLOWED_ORIGIN`: CORS origins (default: *)
- `OPENROUTER_TIMEOUT_MS`: API timeout (default: 30000)
- `OPENROUTER_MAX_TOKENS`: Max generation tokens (default: 500)
- `OPENROUTER_TEMPERATURE`: Generation temperature (default: 0.7)

**Frontend Variables:**
- `VITE_API_URL`: Backend API URL (default: http://localhost:4000/api)

## Development Workflow

**Local Development:**
1. Configure environment variables
2. Start services via Docker Compose
3. Frontend accessible on port 4173
4. Backend accessible on port 4000

**Production Deployment:**
1. Build Docker images
2. Push to ECR
3. Deploy to EC2
4. Configure environment variables on EC2
5. Start containers

## Dependencies

**Backend Dependencies:**
- express: Web framework
- sqlite3: Database driver
- axios: HTTP client
- cors: CORS middleware
- dotenv: Environment variable management
- node-cron: Scheduled task execution

**Frontend Dependencies:**
- react: UI framework
- react-dom: React DOM bindings
- axios: HTTP client

**Development Dependencies:**
- nodemon: Development server (backend)
- vite: Build tool (frontend)
- @vitejs/plugin-react: Vite React plugin

