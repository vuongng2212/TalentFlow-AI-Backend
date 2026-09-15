# Quickstart Validation Guide

1. Start infrastructure: `docker-compose up -d`
2. Apply database migrations: `cd api-gateway && npx prisma migrate dev --name add_cv_parsing_fields`
3. Start the API Gateway: `npm run start:dev`
4. Publish a mock `cv.parsed` event using the RabbitMQ Management UI (localhost:15672) to the `talentflow.events` exchange.
   * Routing key: `cv.parsed`
   * Payload:
     ```json
     {
       "candidateId": "<valid_candidate_id>",
       "applicationId": "<valid_application_id>",
       "jobId": "<valid_job_id>",
       "aiScore": 90,
       "parsedData": {"skills": ["Java"]},
       "scoringReasoning": "Good",
       "parsedAt": "2026-06-18T00:00:00Z"
     }
     ```
5. Observe the API Gateway logs indicating successful consumption, database update, and publishing of the enriched event.
6. Verify in Prisma Studio (`npx prisma studio`) that the `Application` record has `cvParsingStatus` = `COMPLETED` and the score is updated.
