#!/bin/bash

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Header
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════╗"
echo "║      PillPal Deployment Script        ║"
echo "╔═══════════════════════════════════════╗"
echo -e "${NC}"

# Step 1: Check Prerequisites
print_step "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be 18 or higher. Current version: $(node --version)"
    exit 1
fi
print_success "Node.js $(node --version) found"

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi
print_success "npm $(npm --version) found"

if ! command_exists aws; then
    print_error "AWS CLI is not installed. Please install AWS CLI and configure credentials."
    exit 1
fi
print_success "AWS CLI found"

# Check AWS credentials
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    print_error "AWS credentials are not configured. Run 'aws configure' to set up credentials."
    exit 1
fi
print_success "AWS credentials configured"

if ! command_exists terraform; then
    print_error "Terraform is not installed. Please install Terraform and try again."
    exit 1
fi
print_success "Terraform $(terraform version | head -n 1 | cut -d'v' -f2) found"

# Step 2: Install Dependencies
print_step "Installing dependencies..."
npm install
print_success "Dependencies installed"

# Step 3: Lint and Format
print_step "Checking code quality (linting and formatting)..."
if npm run format:check; then
    print_success "Code quality check passed"
else
    print_warning "Code quality issues found. Running auto-fix..."
    npm run format
    print_success "Code formatted and linted"
fi

# Step 4: Build Frontend
print_step "Building frontend..."
npm run build
print_success "Frontend build complete"

# Step 5: Build Lambda Function
print_step "Building Lambda function..."
npm run build:lambda
print_success "Lambda function build complete"

# Step 6: Run Unit Tests
print_step "Running unit tests..."
if npm run test; then
    print_success "Unit tests passed"
else
    print_error "Unit tests failed. Please fix tests and try again."
    exit 1
fi

# Step 7: Terraform Deployment
print_step "Initializing Terraform..."
cd terraform
terraform init
print_success "Terraform initialized"

print_step "Planning Terraform changes..."
terraform plan -out=tfplan
print_success "Terraform plan created"

print_step "Applying Terraform changes..."
echo ""
print_warning "This will deploy infrastructure to AWS. Press Ctrl+C to cancel, or press Enter to continue..."
read -r

terraform apply tfplan
print_success "Terraform apply complete"

# Step 8: Get API Gateway URL
print_step "Retrieving API Gateway URL..."
API_URL=$(terraform output -raw api_gateway_url)
print_success "API Gateway URL: ${API_URL}"

# Step 9: Update .env file
print_step "Updating .env file..."
cd ..
if [ -f ".env" ]; then
    # Update existing .env file
    if grep -q "VITE_API_URL" .env; then
        sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=${API_URL}|" .env
        rm .env.bak 2>/dev/null || true
    else
        echo "VITE_API_URL=${API_URL}" >> .env
    fi
else
    # Create new .env file
    echo "VITE_API_URL=${API_URL}" > .env
fi
print_success ".env file updated with API Gateway URL"

# Final Summary
echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════╗"
echo "║     Deployment Complete! 🎉           ║"
echo "╔═══════════════════════════════════════╗"
echo -e "${NC}"
echo ""
echo "API Gateway URL: ${API_URL}"
echo ""
echo "Next steps:"
echo "  1. Start the frontend dev server: npm run dev"
echo "  2. Access the app at: http://localhost:5173"
echo "  3. The app will connect to the deployed API"
echo ""
echo "To destroy the infrastructure:"
echo "  cd terraform && terraform destroy"
echo ""

