-- Migration 002: Production Hardening
-- Adds 2FA columns, AI quota, moderation status, email verification, bookmarks, reports, cv analyses, chat blocks

-- Add columns to users if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_quota_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_quota_reset_date TEXT;

-- Add moderation status to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved';

-- Email verification OTP table (M2)
CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bookmarked jobs table
CREATE TABLE IF NOT EXISTS job_bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, job_id)
);

-- Content / User report table
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CV analysis logs
CREATE TABLE IF NOT EXISTS cv_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT,
  match_score INTEGER NOT NULL,
  weights_breakdown TEXT,
  suggestions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User chat block table
CREATE TABLE IF NOT EXISTS chat_blocks (
  id TEXT PRIMARY KEY,
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocker_id, blocked_id)
);

-- Performance & Filter Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_hot_pinned ON jobs(is_hot DESC, is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_moderation ON jobs(moderation_status);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON job_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_analyses_user ON cv_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_blocker ON chat_blocks(blocker_id);
