-- Migration 001: Initial Schema
-- WorkLink core tables: users, jobs, applications, freelance_gigs, gig_bids, ratings, notifications, audit_logs, chat_messages

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'job_seeker',
  phone TEXT,
  district TEXT,
  city TEXT DEFAULT 'Hà Nội',
  bio TEXT,
  title TEXT,
  skills TEXT,
  preferred_shift TEXT,
  expected_salary TEXT,
  cv_name TEXT,
  avatar TEXT,
  is_verified INTEGER DEFAULT 1,
  token_version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  employer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_logo TEXT DEFAULT '💼',
  category TEXT NOT NULL,
  district TEXT NOT NULL,
  city TEXT DEFAULT 'Hà Nội',
  address TEXT,
  salary_display TEXT NOT NULL,
  salary_type TEXT DEFAULT 'hourly',
  salary_min INTEGER,
  salary_max INTEGER,
  job_type TEXT DEFAULT 'PART_TIME',
  time_shift TEXT DEFAULT 'Tối',
  time_hours TEXT,
  experience TEXT DEFAULT 'NO_EXPERIENCE',
  description TEXT,
  requirements TEXT,
  benefits TEXT,
  slots INTEGER DEFAULT 1,
  deadline TEXT,
  hashtags TEXT,
  is_hot INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  cv_url TEXT,
  cover_letter TEXT,
  match_score INTEGER,
  status TEXT DEFAULT 'pending',
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS freelance_gigs (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  freelancer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  budget INTEGER NOT NULL,
  deadline TEXT,
  status TEXT DEFAULT 'open',
  deliverables TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gig_bids (
  id TEXT PRIMARY KEY,
  gig_id TEXT NOT NULL REFERENCES freelance_gigs(id) ON DELETE CASCADE,
  freelancer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bid_amount INTEGER NOT NULL,
  proposal TEXT,
  estimated_days INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gig_id TEXT REFERENCES freelance_gigs(id) ON DELETE SET NULL,
  score INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'system',
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_role TEXT,
  target_id TEXT,
  details TEXT,
  ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
