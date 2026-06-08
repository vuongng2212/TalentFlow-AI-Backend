# API Documentation

## POST /api/v1/auth/signup

**Summary**: Register a new user

**Headers**:
```
Authorization: Bearer <token>
```

**Request Payload**:
```json
{
  "email": "string",
  "password": "string",
  "fullName": "string",
  "role": "string"
}
```

**Response (Success)**:
```json
{
  "user": {
    "description": "The user details",
    "allOf": [
      {
        "$ref": "#/components/schemas/AuthResponseDto"
      }
    ]
  },
  "message": "string"
}
```

---

## POST /api/v1/auth/login

**Summary**: User login

**Headers**:
```
Authorization: Bearer <token>
```

**Request Payload**:
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (Success)**:
```json
{
  "user": {
    "description": "The user details",
    "allOf": [
      {
        "$ref": "#/components/schemas/AuthResponseDto"
      }
    ]
  },
  "message": "string"
}
```

---

## POST /api/v1/auth/refresh

**Summary**: Refresh access token using refresh token cookie

**Headers**:
```
Authorization: Bearer <token>
```

**Response (Success)**: OK

---

## GET /api/v1/auth/me

**Summary**: Get current user profile

**Headers**:
```
Authorization: Bearer <token>
```

**Response (Success)**:
```json
{
  "user": {
    "description": "The user details",
    "allOf": [
      {
        "$ref": "#/components/schemas/AuthResponseDto"
      }
    ]
  },
  "message": "string"
}
```

---

## POST /api/v1/auth/logout

**Summary**: Logout and clear cookies

**Headers**:
```
Authorization: Bearer <token>
```

**Response (Success)**: OK

---

## GET /api/v1/users

**Summary**: Get all users with pagination (admin only)

**Headers**:
```
Authorization: Bearer <token>
```

**Response (Success)**:
```json
[
  {
    "id": "string",
    "email": "string",
    "fullName": "string",
    "role": "string",
    "createdAt": "string",
    "updatedAt": "string",
    "deletedAt": "object"
  }
]
```

---

## PATCH /api/v1/users/active-workspace

**Summary**: Switch the active workspace for the current user

**Headers**:
```
Authorization: Bearer <token>
```

**Request Payload**:
```json
{
  "workspaceId": "string"
}
```

**Response (Success)**:
```json
{
  "id": "string",
  "email": "string",
  "fullName": "string",
  "role": "string",
  "createdAt": "string",
  "updatedAt": "string",
  "deletedAt": "object"
}
```

---

## GET /api/v1/users/{id}

**Summary**: Get a user profile by ID

**Headers**:
```
Authorization: Bearer <token>
```

**Response (Success)**:
```json
{
  "id": "string",
  "email": "string",
  "fullName": "string",
  "role": "string",
  "createdAt": "string",
  "updatedAt": "string",
  "deletedAt": "object"
}
```

---

## PATCH /api/v1/users/{id}

**Summary**: Update a user profile (self or admin)

**Headers**:
```
Authorization: Bearer <token>
```

**Request Payload**:
```json
{
  "fullName": "string"
}
```

**Response (Success)**:
```json
{
  "id": "string",
  "email": "string",
  "fullName": "string",
  "role": "string",
  "createdAt": "string",
  "updatedAt": "string",
  "deletedAt": "object"
}
```

---

## DELETE /api/v1/users/{id}

**Summary**: Soft-delete a user (admin only)

**Headers**:
```
Authorization: Bearer <token>
```

---

## PATCH /api/v1/users/{id}/role

**Summary**: Change a user role (admin only)

**Headers**:
```
Authorization: Bearer <token>
```

**Request Payload**:
```json
{
  "role": "string"
}
```

**Response (Success)**:
```json
{
  "id": "string",
  "email": "string",
  "fullName": "string",
  "role": "string",
  "createdAt": "string",
  "updatedAt": "string",
  "deletedAt": "object"
}
```

---

## POST /api/v1/jobs

**Summary**: Create a new job posting

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "title": "string",
  "description": "string",
  "department": "string",
  "location": "string",
  "employmentType": "string",
  "salaryMin": "number",
  "salaryMax": "number",
  "status": "string",
  "requirements": {
    "example": {
      "skills": [
        "React",
        "Node.js"
      ],
      "experience": "3+ years"
    },
    "description": "Structured job requirements",
    "allOf": [
      {
        "$ref": "#/components/schemas/JobRequirementsDto"
      }
    ]
  }
}
```

**Response (Success)**:
```json
{
  "id": "string",
  "title": "string",
  "description": "object",
  "department": "object",
  "location": "object",
  "employmentType": "string",
  "salaryMin": "object",
  "salaryMax": "object",
  "status": "string",
  "requirements": "object",
  "createdById": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

## GET /api/v1/jobs

**Summary**: Get all jobs with pagination and filters

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Response (Success)**: OK

---

## GET /api/v1/jobs/{id}

**Summary**: Get a job by ID

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Response (Success)**:
```json
{
  "id": "string",
  "title": "string",
  "description": "object",
  "department": "object",
  "location": "object",
  "employmentType": "string",
  "salaryMin": "object",
  "salaryMax": "object",
  "status": "string",
  "requirements": "object",
  "createdById": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

## DELETE /api/v1/jobs/{id}

**Summary**: Delete a job (soft delete)

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

---

## PUT /api/v1/jobs/{id}

**Summary**: Update a job posting

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "title": "string",
  "description": "string",
  "department": "string",
  "location": "string",
  "employmentType": "string",
  "salaryMin": "number",
  "salaryMax": "number",
  "status": "string",
  "requirements": {
    "example": {
      "skills": [
        "React",
        "Node.js"
      ],
      "experience": "3+ years"
    },
    "description": "Structured job requirements",
    "allOf": [
      {
        "$ref": "#/components/schemas/JobRequirementsDto"
      }
    ]
  }
}
```

**Response (Success)**:
```json
{
  "id": "string",
  "title": "string",
  "description": "object",
  "department": "object",
  "location": "object",
  "employmentType": "string",
  "salaryMin": "object",
  "salaryMax": "object",
  "status": "string",
  "requirements": "object",
  "createdById": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

## POST /api/v1/applications

**Summary**: Apply to a job

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "jobId": "string",
  "coverLetter": "string",
  "cvFileKey": "string",
  "cvFileUrl": "string"
}
```

**Response (Success)**:
```json
{
  "id": "string",
  "jobId": "string",
  "candidateId": "string",
  "stage": "string",
  "status": "string",
  "cvFileKey": "object",
  "cvFileUrl": "object",
  "coverLetter": "object",
  "notes": "object",
  "appliedAt": "string",
  "reviewedAt": "object",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

## GET /api/v1/applications

**Summary**: Get applications (filtered by role)

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Response (Success)**:
```json
[
  {
    "id": "string",
    "jobId": "string",
    "candidateId": "string",
    "stage": "string",
    "status": "string",
    "cvFileKey": "object",
    "cvFileUrl": "object",
    "coverLetter": "object",
    "notes": "object",
    "appliedAt": "string",
    "reviewedAt": "object",
    "createdAt": "string",
    "updatedAt": "string"
  }
]
```

---

## POST /api/v1/applications/upload

**Summary**: Apply to a job with CV upload

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "file": "string",
  "jobId": "string",
  "coverLetter": "string"
}
```

**Response (Success)**:
```json
{
  "applicationId": "string",
  "fileKey": "string",
  "fileUrl": "string",
  "presignedUrl": "string",
  "status": "string",
  "message": "string"
}
```

---

## GET /api/v1/applications/{id}

**Summary**: Get an application by ID

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Response (Success)**:
```json
{
  "id": "string",
  "jobId": "string",
  "candidateId": "string",
  "stage": "string",
  "status": "string",
  "cvFileKey": "object",
  "cvFileUrl": "object",
  "coverLetter": "object",
  "notes": "object",
  "appliedAt": "string",
  "reviewedAt": "object",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

## DELETE /api/v1/applications/{id}

**Summary**: Withdraw an application (candidates only)

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

---

## PUT /api/v1/applications/{id}

**Summary**: Update an application (stage/status/notes by recruiter, cover letter by candidate)

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "stage": "string",
  "status": "string",
  "notes": "string",
  "coverLetter": "string"
}
```

**Response (Success)**:
```json
{
  "id": "string",
  "jobId": "string",
  "candidateId": "string",
  "stage": "string",
  "status": "string",
  "cvFileKey": "object",
  "cvFileUrl": "object",
  "coverLetter": "object",
  "notes": "object",
  "appliedAt": "string",
  "reviewedAt": "object",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

## GET /api/v1/candidates

**Summary**: Get all candidates with pagination and search

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Response (Success)**: OK

---

## GET /api/v1/candidates/{id}

**Summary**: Get a candidate by ID with their applications

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Response (Success)**:
```json
{
  "id": "string",
  "email": "string",
  "fullName": "string",
  "phone": "object",
  "linkedinUrl": "object",
  "resumeUrl": "object",
  "createdAt": "string",
  "updatedAt": "string",
  "applicationCount": "number"
}
```

---

## PATCH /api/v1/candidates/{id}

**Summary**: Update a candidate

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "fullName": "string",
  "phone": "string",
  "linkedinUrl": "string"
}
```

**Response (Success)**:
```json
{
  "id": "string",
  "email": "string",
  "fullName": "string",
  "phone": "object",
  "linkedinUrl": "object",
  "resumeUrl": "object",
  "createdAt": "string",
  "updatedAt": "string",
  "applicationCount": "number"
}
```

---

## DELETE /api/v1/candidates/{id}

**Summary**: Delete a candidate (admin only)

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

---

## GET /api/v1/analytics/overview

**Summary**: Get overall recruitment statistics

**Headers**:
```
Authorization: Bearer <token>
```

**Response (Success)**:
```json
{
  "totalJobs": "number",
  "openJobs": "number",
  "totalCandidates": "number",
  "totalApplications": "number",
  "hiredCount": "number",
  "hireRate": "number"
}
```

---

## GET /api/v1/analytics/pipeline

**Summary**: Get candidate counts per pipeline stage

**Headers**:
```
Authorization: Bearer <token>
```

**Response (Success)**:
```json
[
  {
    "stage": "string",
    "count": "number"
  }
]
```

---

## GET /api/v1/analytics/trends

**Summary**: Get application trends over time

**Headers**:
```
Authorization: Bearer <token>
```

**Response (Success)**:
```json
[
  {
    "date": "string",
    "applications": "number"
  }
]
```

---

## GET /api/v1/analytics/top-jobs

**Summary**: Get jobs with most applications

**Headers**:
```
Authorization: Bearer <token>
```

**Response (Success)**:
```json
[
  {
    "id": "string",
    "title": "string",
    "department": "object",
    "status": "string",
    "applicationCount": "number"
  }
]
```

---

## POST /api/v1/interviews

**Summary**: Schedule a new interview

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "applicationId": "string",
  "scheduledAt": "string",
  "duration": "number",
  "type": "string",
  "location": "string",
  "notes": "string",
  "interviewerId": "string"
}
```

**Response (Success)**:
```json
{
  "id": "string",
  "applicationId": "string",
  "scheduledAt": "string",
  "duration": "number",
  "type": "string",
  "location": "object",
  "notes": "object",
  "status": "string",
  "interviewerId": "object",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

## GET /api/v1/interviews

**Summary**: Get all interviews with pagination and filters

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Response (Success)**: OK

---

## GET /api/v1/interviews/{id}

**Summary**: Get an interview by ID

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Response (Success)**:
```json
{
  "id": "string",
  "applicationId": "string",
  "scheduledAt": "string",
  "duration": "number",
  "type": "string",
  "location": "object",
  "notes": "object",
  "status": "string",
  "interviewerId": "object",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

## PATCH /api/v1/interviews/{id}

**Summary**: Update/reschedule an interview

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "scheduledAt": "string",
  "duration": "number",
  "type": "string",
  "location": "string",
  "notes": "string",
  "status": "string",
  "interviewerId": "string"
}
```

**Response (Success)**:
```json
{
  "id": "string",
  "applicationId": "string",
  "scheduledAt": "string",
  "duration": "number",
  "type": "string",
  "location": "object",
  "notes": "object",
  "status": "string",
  "interviewerId": "object",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

## DELETE /api/v1/interviews/{id}

**Summary**: Cancel an interview

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

---

## POST /api/v1/workspaces

**Summary**: Create a workspace

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "name": "string",
  "isBusiness": "boolean"
}
```

**Response (Success)**: OK

---

## POST /api/v1/workspaces/{id}/members

**Summary**: Add a member to workspace

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "email": "string",
  "role": {
    "description": "Role assigned to the invited member. Defaults to RECRUITER when omitted.",
    "default": "RECRUITER",
    "allOf": [
      {
        "$ref": "#/components/schemas/WorkspaceMemberRole"
      }
    ]
  }
}
```

**Response (Success)**: OK

---

## GET /api/v1/workspaces/{id}/members

**Summary**: List active workspace members

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Response (Success)**: OK

---

## POST /api/v1/workspaces/{id}/invitations

**Summary**: Invite a new member by email (Business Workspace only)

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "email": "string",
  "role": "string"
}
```

**Response (Success)**: OK

---

## POST /api/v1/workspaces/invitations/accept

**Summary**: Accept a workspace invitation via token

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "token": "string"
}
```

**Response (Success)**: OK

---

## POST /api/v1/email-templates

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "name": "string",
  "subject": "string",
  "body": "string"
}
```

**Response (Success)**: OK

---

## GET /api/v1/email-templates

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Response (Success)**: OK

---

## GET /api/v1/email-templates/{id}

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Response (Success)**: OK

---

## PATCH /api/v1/email-templates/{id}

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

**Request Payload**:
```json
{
  "subject": "string",
  "body": "string"
}
```

**Response (Success)**: OK

---

## DELETE /api/v1/email-templates/{id}

**Headers**:
```
Authorization: Bearer <token>
x-workspace-id: string
```

---

