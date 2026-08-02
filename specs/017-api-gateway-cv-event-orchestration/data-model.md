# Data Model Changes

## Entity: Application (Update)

Add the following fields to `Application` in `schema.prisma`:

```prisma
enum CvParsingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model Application {
  // ... existing fields
  cvParsingStatus CvParsingStatus @default(PENDING) @map("cv_parsing_status")
  aiScore         Int?            @map("ai_score")
  scoringReasoning String?        @map("scoring_reasoning") @db.Text
  parsedData      Json?           @map("parsed_data")
}
```

## Contracts / Event Shapes

See `/contracts` directory for the payload shapes.
