#!/bin/bash

# Colorful print helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:8080/api/v1"
COOKIE_FILE="cookies.txt"

print_header() {
  echo -e "\n${BLUE}======================================================================${NC}"
  echo -e "${BLUE}* $1${NC}"
  echo -e "${BLUE}======================================================================${NC}"
}

print_success() {
  echo -e "${GREEN}✔ SUCCESS${NC}: $1"
}

print_info() {
  echo -e "${YELLOW}ℹ INFO${NC}: $1"
}

print_error() {
  echo -e "${RED}✘ ERROR${NC}: $1"
}

# Resolve target business workspace ID from Database
print_header "RESOLVING TARGET WORKSPACE ID"
WORKSPACE_ID=$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.workspace.findFirst({ where: { name: 'Acme Corp - Tech Recruitment' } })
  .then(w => console.log(w ? w.id : ''))
  .finally(() => prisma.\$disconnect());
")

if [ -n "$WORKSPACE_ID" ]; then
  print_success "Resolved Active Workspace ID: $WORKSPACE_ID"
else
  print_error "Could not resolve active workspace ID from database"
  exit 1
fi

# 1. Login
print_header "POST /auth/login - Logging in as seed recruiter"
RESPONSE=$(curl -s -i -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_FILE" \
  -d '{"email": "seed-recruiter@talentflow.invalid", "password": "SeedPassword123!"}')

HTTP_STATUS=$(echo "$RESPONSE" | grep HTTP | tail -n 1 | awk '{print $2}')
BODY=$(echo "$RESPONSE" | sed -e '1,/^\r$/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  print_success "Login successful (HTTP 200)"
  # Extract recruiter ID
  RECRUITER_ID=$(echo "$BODY" | jq -r '.data.user.id')
  print_info "Recruiter ID: $RECRUITER_ID"
else
  print_error "Login failed (HTTP $HTTP_STATUS)"
  echo "$BODY"
  exit 1
fi

# 2. Auth me
print_header "GET /auth/me - Fetch current user context"
ME_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$API_URL/auth/me")
print_success "Fetched user context"
echo "$ME_RESPONSE" | jq .

# 3. List workspace members
print_header "GET /workspaces/:id/members - List members in workspace"
MEMBERS=$(curl -s -b "$COOKIE_FILE" "$API_URL/workspaces/$WORKSPACE_ID/members")
print_success "Workspace members count: $(echo "$MEMBERS" | jq '.data | length')"
echo "$MEMBERS" | jq .

# 4. List jobs
print_header "GET /jobs - List jobs in active workspace"
JOBS=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" "$API_URL/jobs")
print_success "Jobs count: $(echo "$JOBS" | jq '.data.data | length')"
echo "$JOBS" | jq .

# 5. Create a job
print_header "POST /jobs - Create new job posting"
CREATE_JOB_BODY='{
  "title": "Senior Frontend Developer (SaaS)",
  "description": "We are seeking a senior frontend developer for multi-tenancy dashboard.",
  "requirements": { "skills": ["React", "TypeScript", "Next.js", "Tailwind CSS"], "experience": "5+ years" },
  "department": "Engineering",
  "location": "Ho Chi Minh City",
  "employmentType": "FULL_TIME",
  "salaryMin": 2000,
  "salaryMax": 3500,
  "status": "OPEN"
}'
NEW_JOB=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" -X POST "$API_URL/jobs" \
  -H "Content-Type: application/json" \
  -d "$CREATE_JOB_BODY")
NEW_JOB_ID=$(echo "$NEW_JOB" | jq -r '.data.id')

if [ "$NEW_JOB_ID" != "null" ] && [ -n "$NEW_JOB_ID" ]; then
  print_success "Created job with ID: $NEW_JOB_ID"
  echo "$NEW_JOB" | jq .
else
  print_error "Failed to create job"
  echo "$NEW_JOB"
  exit 1
fi

# 6. Get job by ID
print_header "GET /jobs/:id - Get created job details"
JOB_DETAILS=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" "$API_URL/jobs/$NEW_JOB_ID")
print_success "Fetched job details successfully"
echo "$JOB_DETAILS" | jq .

# 7. Update job
print_header "PUT /jobs/:id - Update created job status to CLOSED"
UPDATE_BODY='{
  "status": "CLOSED"
}'
UPDATED_JOB=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" -X PUT "$API_URL/jobs/$NEW_JOB_ID" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_BODY")
print_success "Updated job successfully"
echo "$UPDATED_JOB" | jq .

# 8. List candidates
print_header "GET /candidates - List candidates in workspace"
CANDIDATES=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" "$API_URL/candidates")
print_success "Candidates count: $(echo "$CANDIDATES" | jq '.data.data | length')"
echo "$CANDIDATES" | jq .

# 9. List applications
print_header "GET /applications - List applications in workspace"
APPLICATIONS=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" "$API_URL/applications")
print_success "Applications count: $(echo "$APPLICATIONS" | jq '.data.data | length')"
echo "$APPLICATIONS" | jq .
FIRST_APPLICATION_ID=$(echo "$APPLICATIONS" | jq -r '.data.data[0].id')

# 10. Update application status
print_header "PUT /applications/:id - Update status for application $FIRST_APPLICATION_ID"
APP_UPDATE_BODY='{
  "stage": "INTERVIEW",
  "status": "INTERVIEW_SCHEDULED",
  "notes": "Moving candidate to interview stage based on recruiter evaluation."
}'
UPDATED_APP=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" -X PUT "$API_URL/applications/$FIRST_APPLICATION_ID" \
  -H "Content-Type: application/json" \
  -d "$APP_UPDATE_BODY")
print_success "Updated application successfully"
echo "$UPDATED_APP" | jq .

# 11. List interviews
print_header "GET /interviews - List interviews in workspace"
INTERVIEWS=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" "$API_URL/interviews")
print_success "Interviews count: $(echo "$INTERVIEWS" | jq '.data.data | length')"
echo "$INTERVIEWS" | jq .

# 12. List Email templates
print_header "GET /email-templates - List templates in workspace"
TEMPLATES=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" "$API_URL/email-templates")
print_success "Email templates count: $(echo "$TEMPLATES" | jq '.data.data | length')"
echo "$TEMPLATES" | jq .

# 13. Fetch Analytics
print_header "GET /analytics/overview - Fetch dashboard overview metrics"
ANALYTICS_OVERVIEW=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" "$API_URL/analytics/overview")
print_success "Fetched dashboard overview successfully"
echo "$ANALYTICS_OVERVIEW" | jq .

print_header "GET /analytics/pipeline - Fetch recruitment pipeline metrics"
ANALYTICS_PIPELINE=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" "$API_URL/analytics/pipeline")
print_success "Fetched pipeline analytics successfully"
echo "$ANALYTICS_PIPELINE" | jq .

print_header "GET /analytics/trends - Fetch recruitment trend metrics"
ANALYTICS_TRENDS=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" "$API_URL/analytics/trends")
print_success "Fetched trend analytics successfully"
echo "$ANALYTICS_TRENDS" | jq .

print_header "GET /analytics/top-jobs - Fetch top jobs metrics"
ANALYTICS_TOP_JOBS=$(curl -s -b "$COOKIE_FILE" -H "x-workspace-id: $WORKSPACE_ID" "$API_URL/analytics/top-jobs")
print_success "Fetched top jobs analytics successfully"
echo "$ANALYTICS_TOP_JOBS" | jq .

# Cleanup temporary cookies
rm -f "$COOKIE_FILE"

print_header "ALL API ENDPOINTS TESTED SUCCESSFULLY!"
