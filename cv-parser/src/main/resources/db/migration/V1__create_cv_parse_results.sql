-- V1__create_cv_parse_results.sql
-- Creates the cv_parser schema and cv_parse_results table for CV processing persistence.
-- This is the foundational migration for the scoring pipeline feature.

CREATE SCHEMA IF NOT EXISTS cv_parser;

SET SCHEMA 'cv_parser';

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE cv_parse_results (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id    UUID        NOT NULL,
    candidate_id      UUID        NOT NULL,
    job_id            UUID        NOT NULL,
    status            VARCHAR(16) NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
    ai_score          INTEGER     CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
    scoring_reasoning TEXT,
    scoring_status    VARCHAR(16) CHECK (scoring_status IS NULL OR scoring_status IN ('SUCCESS', 'FALLBACK', 'SKIPPED')),
    parsed_data       JSONB,
    error_code        VARCHAR(64),
    error_message     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ,

    CONSTRAINT uq_cv_parse_results_application UNIQUE (application_id)
);

CREATE INDEX idx_cv_parse_results_application_id ON cv_parse_results (application_id);
CREATE INDEX idx_cv_parse_results_candidate_id   ON cv_parse_results (candidate_id);
CREATE INDEX idx_cv_parse_results_status         ON cv_parse_results (status);

COMMENT ON TABLE  cv_parse_results IS 'One row per CV processing attempt. Unique on application_id for idempotency.';
COMMENT ON COLUMN cv_parse_results.ai_score IS 'AI match score 0-100. Null if scoring was skipped or failed irrecoverably.';
COMMENT ON COLUMN cv_parse_results.scoring_status IS 'How the score was produced: SUCCESS (Gemini), FALLBACK (50-unavailable), SKIPPED (no job description).';
COMMENT ON COLUMN cv_parse_results.parsed_data IS 'JSON containing fullName, email, skills, experience, education from extraction.';
