#!/bin/bash
set -e

echo "============================================="
echo "  Loan Origination System - Setup Script"
echo "============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required tools
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}Error: $1 is not installed.${NC}"
    echo "Please install $1 before running this script."
    exit 1
  fi
}

echo "Checking prerequisites..."
check_command node
check_command npm
check_command psql

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}Error: Node.js 18+ is required. Found version $(node -v)${NC}"
  exit 1
fi
echo -e "${GREEN}Node.js $(node -v) detected${NC}"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Setup environment files
echo ""
echo "Setting up environment files..."

if [ ! -f backend/.env ]; then
  if [ -f backend/.env.example ]; then
    cp backend/.env.example backend/.env
    echo -e "${GREEN}Created backend/.env from .env.example${NC}"
  else
    cat > backend/.env << 'EOF'
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://los_user:los_password@localhost:5432/los_db
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
FRONTEND_URL=http://localhost:3000
UPLOAD_DIR=./uploads
EOF
    echo -e "${GREEN}Created backend/.env with defaults${NC}"
  fi
else
  echo -e "${YELLOW}backend/.env already exists, skipping${NC}"
fi

# Setup PostgreSQL database
echo ""
echo "Setting up PostgreSQL database..."

# Source the .env to get DB connection info
DB_URL=$(grep DATABASE_URL backend/.env | cut -d'=' -f2-)
DB_NAME=$(echo "$DB_URL" | sed 's/.*\///' | cut -d'?' -f1)
DB_USER=$(echo "$DB_URL" | sed 's/.*:\/\///' | cut -d':' -f1)
DB_PASS=$(echo "$DB_URL" | sed 's/.*:\/\/[^:]*://' | cut -d'@' -f1)
DB_HOST=$(echo "$DB_URL" | sed 's/.*@//' | cut -d':' -f1)
DB_PORT=$(echo "$DB_URL" | sed 's/.*@[^:]*://' | cut -d'/' -f1)

# Try to create user and database
echo "Creating database user and database..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo -e "${YELLOW}User $DB_USER may already exist${NC}"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo -e "${YELLOW}Database $DB_NAME may already exist${NC}"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

echo -e "${GREEN}Database setup complete${NC}"

# Install backend dependencies
echo ""
echo "Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
npm install
echo -e "${GREEN}Backend dependencies installed${NC}"

# Run database migrations
echo ""
echo "Running database migrations..."
node src/migrations/run.js
echo -e "${GREEN}Migrations complete${NC}"

# Run database seeds
echo ""
echo "Seeding database..."
node src/seeds/run.js
echo -e "${GREEN}Seed data loaded${NC}"

# Create uploads directory
mkdir -p uploads

# Install frontend dependencies
echo ""
echo "Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
npm install
echo -e "${GREEN}Frontend dependencies installed${NC}"

# Build frontend
echo ""
echo "Building frontend..."
npm run build 2>/dev/null || echo -e "${YELLOW}Frontend build skipped (development mode)${NC}"

echo ""
echo "============================================="
echo -e "${GREEN}  Setup Complete!${NC}"
echo "============================================="
echo ""
echo "To start the application:"
echo ""
echo "  1. Start the backend:"
echo "     cd backend && npm run dev"
echo ""
echo "  2. Start the frontend (in a new terminal):"
echo "     cd frontend && npm run dev"
echo ""
echo "  3. Open http://localhost:3000 in your browser"
echo ""
echo "Demo Accounts (all use password: Password123!):"
echo "  - borrower1@example.com     (Borrower)"
echo "  - lo1@lossystem.com         (Loan Officer)"
echo "  - bm1@lossystem.com         (Branch Manager)"
echo "  - uw1@lossystem.com         (Underwriter)"
echo "  - compliance@lossystem.com  (Compliance Officer)"
echo "  - admin@lossystem.com       (System Admin)"
echo "  - exec@lossystem.com        (Executive)"
echo ""
echo "To run tests:"
echo "  cd backend && npm test"
echo "  cd frontend && npm test"
echo ""
