# Event Contracts

## Consumer Contract (From CV Parser)

**Exchange**: `talentflow.events`
**Routing Keys**: `cv.parsed`, `cv.failed`

### Raw Success Payload (`cv.parsed`)
```json
{
  "candidateId": "uuid",
  "applicationId": "uuid",
  "jobId": "uuid",
  "aiScore": 85,
  "parsedData": { /* JSON object */ },
  "scoringReasoning": "Strong match with requirements.",
  "parsedAt": "2026-06-18T10:00:00Z"
}
```

### Raw Failure Payload (`cv.failed`)
```json
{
  "candidateId": "uuid",
  "applicationId": "uuid",
  "jobId": "uuid",
  "errorCode": "PARSE_ERR_01",
  "errorMessage": "Unsupported file format",
  "retryable": false,
  "failedAt": "2026-06-18T10:00:00Z"
}
```

## Producer Contract (To Notification Service)

**Exchange**: `talentflow.events`
**Routing Keys**: `notification.cv.success`, `notification.cv.failed` (or mapped to general `notification.send` with specific type)

### Enriched Success Payload
```json
{
  "applicationId": "uuid",
  "recruiterId": "uuid",
  "jobTitle": "Senior Backend Engineer",
  "applicantEmail": "candidate@example.com",
  "applicantName": "John Doe",
  "aiScore": 85,
  "timestamp": "2026-06-18T10:00:05Z"
}
```

### Enriched Failure Payload
```json
{
  "applicationId": "uuid",
  "recruiterId": "uuid",
  "jobTitle": "Senior Backend Engineer",
  "applicantEmail": "candidate@example.com",
  "applicantName": "John Doe",
  "errorMessage": "Unsupported file format",
  "timestamp": "2026-06-18T10:00:05Z"
}
```
