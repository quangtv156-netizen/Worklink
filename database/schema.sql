-- ========================================================
-- WORKLINK DATABASE SCHEMA (PostgreSQL 14+)
-- ========================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'job_seeker', -- 'job_seeker', 'employer', 'admin'
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
  ai_quota INTEGER DEFAULT 5,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  employer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_logo TEXT DEFAULT '💼',
  category TEXT NOT NULL, -- 'F&B', 'IT', 'Bán hàng', 'Marketing', 'Gia sư', 'Kho vận', 'Thiết kế'
  district TEXT NOT NULL,
  city TEXT DEFAULT 'Hà Nội',
  address TEXT,
  salary_display TEXT NOT NULL,
  salary_type TEXT DEFAULT 'hourly', -- 'hourly', 'monthly'
  salary_min INTEGER,
  salary_max INTEGER,
  job_type TEXT DEFAULT 'PART_TIME', -- 'PART_TIME', 'FULL_TIME', 'INTERN', 'FREELANCE'
  time_shift TEXT DEFAULT 'Tối',
  time_hours TEXT,
  experience TEXT DEFAULT 'NO_EXPERIENCE',
  description TEXT,
  requirements TEXT, -- JSON string or comma-separated
  benefits TEXT, -- JSON string or comma-separated
  slots INTEGER DEFAULT 1,
  deadline TEXT,
  hashtags TEXT, -- JSON string or space-separated
  is_hot INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'active', 'rejected', 'expired'
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  note TEXT,
  cv_name TEXT,
  cv_file_path TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'interview', 'rejected'
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS freelance_projects (
  id TEXT PRIMARY KEY,
  employer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  client TEXT NOT NULL,
  budget TEXT NOT NULL,
  budget_num INTEGER,
  duration TEXT NOT NULL,
  category TEXT NOT NULL,
  skills TEXT, -- comma-separated
  description TEXT,
  deadline TEXT,
  hashtags TEXT,
  proposals_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'OPEN',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gig_tasks (
  id TEXT PRIMARY KEY,
  employer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  reward TEXT NOT NULL,
  reward_num INTEGER,
  time_needed TEXT,
  cargo_type TEXT NOT NULL,
  is_valuable INTEGER DEFAULT 0,
  requires_contract INTEGER DEFAULT 0,
  pickup_name TEXT NOT NULL,
  pickup_address TEXT,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  dropoff_name TEXT NOT NULL,
  dropoff_address TEXT,
  dropoff_lat DOUBLE PRECISION NOT NULL,
  dropoff_lng DOUBLE PRECISION NOT NULL,
  distance_km DOUBLE PRECISION,
  note TEXT,
  sender TEXT,
  receiver TEXT,
  status TEXT DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'ACCEPTED', 'COMPLETED'
  accepted_by TEXT,
  accepted_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Freelance Proposals: Đề xuất báo giá từ freelancer cho dự án
CREATE TABLE IF NOT EXISTS freelance_proposals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES freelance_projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  bid TEXT NOT NULL,
  duration TEXT NOT NULL,
  cover TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rating & Review: ứng viên đánh giá NTD (hoặc ngược lại) sau phỏng vấn
CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
  reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL, -- 'job_seeker' hoặc 'employer'
  target_type TEXT NOT NULL,   -- 'company' hoặc 'applicant'
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  tags TEXT,                 -- JSON: ["đúng giờ","chuyên nghiệp"]
  is_anonymous INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications: thông báo realtime cho user
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,        -- 'new_application', 'status_change', 'new_job', 'message'
  title TEXT NOT NULL,
  body TEXT,
  link_type TEXT,            -- 'job', 'application', 'chat'
  link_id TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat Threads: Quản lý phòng chat và quyền truy cập hội thoại
CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  seeker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat: tin nhắn realtime giữa NTD và ứng viên
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Password Reset Tokens: Lưu token đặt lại mật khẩu an toàn
CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email Verification OTPs: Xác thực tài khoản qua email
CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Job Bookmarks: Lưu tin tuyển dụng yêu thích
CREATE TABLE IF NOT EXISTS job_bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, job_id)
);

-- Reports: Báo cáo tin tuyển dụng ảo / người dùng vi phạm
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL, -- 'job', 'user', 'gig', 'freelance'
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CV Analyses History: Lịch sử phân tích CV và giải thích điểm ATS
CREATE TABLE IF NOT EXISTS cv_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  cv_name TEXT,
  ats_score INTEGER,
  summary TEXT,
  strengths TEXT,
  improvements TEXT,
  breakdown TEXT,
  matched_jobs TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat Blocks: Chặn người dùng trong hội thoại
CREATE TABLE IF NOT EXISTS chat_blocks (
  id TEXT PRIMARY KEY,
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocker_id, blocked_id)
);

-- Audit Logs: Lịch sử thao tác kiểm toán bảo mật & kiểm duyệt của Quản trị viên
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- INDEXES FOR HIGH PERFORMANCE QUERYING
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_district ON jobs(district);
CREATE INDEX IF NOT EXISTS idx_jobs_employer ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_deadline ON jobs(deadline);
CREATE INDEX IF NOT EXISTS idx_jobs_hot_pinned ON jobs(is_hot, is_pinned);

-- GIN Full-Text Search Index: Tối ưu hoá truy vấn tìm kiếm việc làm toàn văn bản trong PostgreSQL
CREATE INDEX IF NOT EXISTS idx_jobs_fts ON jobs USING gin(
  to_tsvector('simple', 
    COALESCE(title, '') || ' ' || 
    COALESCE(company, '') || ' ' || 
    COALESCE(category, '') || ' ' || 
    COALESCE(district, '') || ' ' || 
    COALESCE(description, '') || ' ' || 
    COALESCE(requirements, '') || ' ' || 
    COALESCE(hashtags, '')
  )
);

CREATE INDEX IF NOT EXISTS idx_apps_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_apps_user ON applications(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_apps_unique ON applications(job_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_freelance_prop_unique ON freelance_proposals(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_freelance_employer ON freelance_projects(employer_id);
CREATE INDEX IF NOT EXISTS idx_gig_employer ON gig_tasks(employer_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_unique ON ratings(job_id, reviewer_id);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_thread_members ON chat_threads(seeker_id, employer_id);
CREATE INDEX IF NOT EXISTS idx_chat_thread ON chat_messages(thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
CREATE INDEX IF NOT EXISTS idx_email_verif_user ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON job_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_cv_analyses_user ON cv_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_applications_deleted_at ON applications(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cv_analyses_deleted_at ON cv_analyses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
