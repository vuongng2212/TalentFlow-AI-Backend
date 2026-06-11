-- Add EXPIRED value to WorkspaceMemberStatus enum
ALTER TYPE "WorkspaceMemberStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
