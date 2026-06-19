-- CreateEnum
CREATE TYPE "CvParsingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "ai_score" INTEGER,
ADD COLUMN     "cv_parsing_status" "CvParsingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "parsed_data" JSONB,
ADD COLUMN     "scoring_reasoning" TEXT;
