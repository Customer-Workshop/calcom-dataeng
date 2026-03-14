# Loan Origination System (LOS)

A fully functional Loan Origination System built with Node.js, Express, PostgreSQL, and React. Supports 7 persona-based views covering the complete loan lifecycle from application through funding and servicing handoff.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Zustand)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Borrower │ │  Loan    │ │  Branch  │ │Underwriter│      │
│  │  Portal  │ │ Officer  │ │ Manager  │ │  Queue   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │Compliance│ │  System  │ │Executive │                    │
│  │  Panel   │ │  Admin   │ │Dashboard │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API (JWT Auth)
┌────────────────────────┴────────────────────────────────────┐
│                 Backend (Node.js + Express)                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Services: Auth, Applications, Collateral, Credit,      │  │
│  │ Identity, Income, Decisioning, Conditions, Documents,  │  │
│  │ E-Signature, Funding, Handoff, Notifications, Audit,   │  │
│  │ State Rules, TILA, Reporting                           │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Middleware: JWT Auth, RBAC, Validation (Zod), Rate     │  │
│  │ Limiting, CORS, Helmet, Morgan                         │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                   PostgreSQL Database                         │
│  18 tables: branches, roles, users, loan_products,           │
│  borrowers, applications, collateral, valuations,            │
│  credit_reports, decisions, conditions, documents,           │
│  loans, funding_instructions, state_rules, audit_logs,       │
│  e_signatures, notifications                                 │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Backend | Node.js + Express | Wider LOS ecosystem, strong middleware for auth + file handling |
| Database | PostgreSQL | Relational integrity for loan/collateral/document relationships, JSONB for flexible rule storage |
| Frontend | React | Component reuse across 7 personas, mature ecosystem for complex form flows |
| State Mgmt | Zustand | Lightweight, sufficient for session + pipeline state without Redux boilerplate |
| Styling | Tailwind CSS | Rapid UI development with utility-first approach |
| Charts | Recharts | React-native charting for executive dashboard KPIs |
| Validation | Zod (backend) / React Hook Form (frontend) | Type-safe validation on both ends |
| Auth | JWT + bcrypt | Stateless authentication with secure password hashing |
| PDF | PDFKit | Loan agreement and adverse action notice generation |

## Persona Access Map

| Persona | Access Level | Key Features |
|---------|-------------|--------------|
| **Borrower** | Own applications only | Apply, track status, upload docs, view decisions, e-sign, respond to counter-offers |
| **Loan Officer** | Assigned pipeline | Intake, collateral capture, credit pulls, submit for underwriting, clear conditions |
| **Branch Manager** | Branch pipeline | Team overview, approval authority ($500k), reassign loans between officers |
| **Underwriter** | Review queue | Prioritized review, manual decisions, reason codes, conditions, counter-offers |
| **Compliance Officer** | System-wide compliance | State rule configuration, audit trail, adverse action log |
| **System Admin** | Full system access | User management, product/rate config, branch management, state enable/disable |
| **Executive** | Reporting only | Approval rate, avg LTV, time-to-fund, volume by state/branch/product |

## LOS Workflow

```
Application → Pre-Qualification → Credit Pull → Identity Check → Income Verification
     │                                                                    │
     └─────────────────────→ Decisioning Engine ←─────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              Auto-Approve      Refer to UW     Auto-Decline
                    │               │               │
                    │         Manual Review    Adverse Action
                    │          ┌────┴────┐     Notice (ECOA)
                    │       Approve  Counter
                    │          │     Offer
                    │          │       │
                    │          │    Borrower
                    │          │    Accept/Reject
                    │          │       │
                    └──────────┴───────┘
                           │
                    Conditions Management
                    (create, track, clear)
                           │
                      E-Signature
                    (PDF generation)
                           │
                    Funding Authorization
                    (ACH disbursement)
                           │
                    Handoff to Servicing
                    (JSON/PDF export)
```

## Database Schema

### Core Tables (18 total)

1. **branches** - Physical branch locations
2. **roles** - System roles (borrower, loan_officer, branch_manager, underwriter, compliance_officer, system_admin, executive)
3. **users** - All system users with role and branch assignments
4. **loan_products** - Configurable loan products with rate/term/amount ranges
5. **borrowers** - Borrower personal and financial information
6. **applications** - Loan applications with full lifecycle status tracking
7. **collateral** - Vehicle/property collateral with VIN, condition grading
8. **valuations** - NADA/KBB mock valuations for collateral
9. **credit_reports** - Soft and hard credit pull results with scores and tradelines
10. **decisions** - Decision engine results (auto-approve, refer, decline, manual, counter-offer)
11. **conditions** - Prior-to-funding and prior-to-doc conditions
12. **documents** - Uploaded documents with categorization and review status
13. **loans** - Funded loans with terms, rates, and payment schedules
14. **funding_instructions** - ACH disbursement details
15. **state_rules** - Configurable state-specific rules (rate caps, fee limits, disclosures)
16. **audit_logs** - Full audit trail (every action, timestamped, user-attributed)
17. **e_signatures** - Electronic signature records with PDF references
18. **notifications** - Email/SMS notification log

## Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

### Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd los-app

# 2. Run automated setup
chmod +x setup.sh
./setup.sh

# 3. Start the backend (terminal 1)
cd backend
npm run dev

# 4. Start the frontend (terminal 2)
cd frontend
npm run dev

# 5. Open http://localhost:3000
```

### Manual Setup

```bash
# Backend setup
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL connection details
npm install
node src/migrations/run.js
node src/seeds/run.js
npm run dev

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4000 | Backend server port |
| DATABASE_URL | postgresql://los_user:los_password@localhost:5432/los_db | PostgreSQL connection string |
| JWT_SECRET | (set in .env) | JWT signing secret |
| JWT_EXPIRES_IN | 24h | JWT token expiration |
| FRONTEND_URL | http://localhost:3000 | Frontend URL for CORS |
| NODE_ENV | development | Environment mode |

## Demo Accounts

All demo accounts use password: `Password123!`

| Email | Role | Description |
|-------|------|-------------|
| borrower1@example.com | Borrower | Sample borrower account |
| lo1@lossystem.com | Loan Officer | Loan officer at Main Branch |
| bm1@lossystem.com | Branch Manager | Branch manager at Main Branch |
| uw1@lossystem.com | Underwriter | Senior underwriter |
| compliance@lossystem.com | Compliance Officer | Compliance and audit |
| admin@lossystem.com | System Admin | Full system access |
| exec@lossystem.com | Executive | Executive reporting |

## Seed Data

- **3 Loan Products**: Personal Secured, Auto Secured, Home Improvement
- **5 Branches**: Main, Downtown, Westside, Northgate, Southpark
- **10 Loan Officers**: Distributed across branches
- **3 Underwriters**: With varying authority limits
- **10 Sample Applications**: At various lifecycle stages
- **3 State Rules**: Texas, Florida, Ohio (with rate caps, fee limits, disclosures)

## Running Tests

```bash
# Backend API tests (15+ tests)
cd backend
npm test

# Frontend UI tests (11+ tests)
cd frontend
npm test

# Run specific test suite
cd backend
npx jest tests/services.test.js
npx jest tests/api.test.js
npx jest tests/e2e.test.js
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register borrower
- `POST /api/auth/login` - Login and get JWT
- `GET /api/auth/me` - Get current user

### Applications
- `GET /api/applications` - List with pagination/filtering
- `GET /api/applications/:id` - Get with related data
- `POST /api/applications` - Create new application
- `PUT /api/applications/:id` - Update application
- `POST /api/applications/:id/pre-qualify` - Soft credit pull
- `POST /api/applications/:id/credit-pull` - Hard credit pull
- `POST /api/applications/:id/identity-check` - Identity verification
- `POST /api/applications/:id/verify-income` - Income verification
- `POST /api/applications/:id/decision` - Run decisioning engine
- `POST /api/applications/:id/manual-decision` - Underwriter manual decision
- `POST /api/applications/:id/counter-offer-response` - Accept/reject counter
- `POST /api/applications/:id/e-sign` - E-signature with TILA
- `POST /api/applications/:id/fund` - Authorize funding
- `POST /api/applications/:id/handoff` - Export to servicing
- `POST /api/applications/:id/reassign` - Reassign officer/underwriter

### Collateral
- `GET /api/collateral/:applicationId` - Get collateral
- `POST /api/collateral/:applicationId` - Create/update with VIN auto-populate
- `GET /api/collateral/vin-lookup/:vin` - VIN lookup

### Conditions & Documents
- `GET /api/conditions/:applicationId` - List conditions
- `POST /api/conditions/:applicationId` - Create condition
- `PUT /api/conditions/clear/:id` - Clear condition
- `GET /api/documents/:applicationId` - List documents
- `POST /api/documents/:applicationId` - Upload document

### Admin
- `GET/POST /api/admin/users` - User management
- `GET /api/admin/roles` - List roles
- `GET/POST /api/admin/branches` - Branch management
- `GET/PUT /api/admin/loan-products` - Product configuration
- `GET/PUT/POST /api/admin/state-rules` - State rule configuration
- `GET /api/admin/audit-logs` - Audit trail

### Reporting
- `GET /api/reporting/dashboard` - Executive KPIs
- `GET /api/reporting/pipeline` - Pipeline summary
- `GET /api/reporting/adverse-actions` - Adverse action log

## Business Logic

### Decisioning Engine
The rules-based decisioning engine evaluates applications using:
- **Credit Score**: From mock credit bureau (300-850)
- **LTV Ratio**: Loan amount / collateral value
- **DTI Ratio**: Monthly debt payments / monthly income

| Decision | Credit Score | LTV | DTI |
|----------|-------------|-----|-----|
| Auto-Approve | >= 700 | <= 80% | <= 36% |
| Refer to UW | >= 620 | <= 95% | <= 45% |
| Auto-Decline | < 620 | > 95% | > 45% |

### Authority Limits
- Loan Officer: Up to $100,000
- Branch Manager: Up to $500,000
- Underwriter: Up to $1,000,000

### TILA Disclosures
Generated for every approved loan:
- Annual Percentage Rate (APR)
- Finance Charge
- Total of Payments
- Monthly Payment Amount

### Compliance Features
- State-specific rate caps and fee limits
- ECOA-compliant adverse action notices
- Right of rescission tracking (3-day period)
- Full audit trail with user attribution

## Troubleshooting

### Database Connection Issues
```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U los_user -d los_db -h localhost

# Reset database
node src/migrations/run.js
node src/seeds/run.js
```

### Port Conflicts
```bash
# Check if ports are in use
lsof -i :4000  # Backend
lsof -i :3000  # Frontend
```

### Common Issues
- **JWT errors**: Ensure JWT_SECRET is set in backend/.env
- **CORS errors**: Verify FRONTEND_URL in backend/.env matches your frontend URL
- **Migration errors**: Ensure DATABASE_URL is correct and PostgreSQL is running

## Known Limitations & Phase 2 Recommendations

### Current Limitations
- External API calls (credit bureau, OFAC, NADA/KBB) are mocked
- File uploads store metadata only (no actual file storage)
- Email/SMS notifications are logged to console only
- Single-server deployment (no horizontal scaling)

### Phase 2 Recommendations
- Integrate real credit bureau APIs (Equifax, Experian, TransUnion)
- Add real OFAC/SDN screening via FinCEN API
- Implement actual NADA/KBB valuation APIs
- Add S3/MinIO for document storage
- Integrate SendGrid/Twilio for real notifications
- Add WebSocket support for real-time updates
- Implement OAuth2/SSO for enterprise authentication
- Add Docker containerization with docker-compose
- Add CI/CD pipeline with automated testing
- Performance optimization with Redis caching
- Add co-borrower support
- Implement loan modification and payment tracking
