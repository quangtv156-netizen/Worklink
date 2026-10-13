-- ============================================================
-- Migration 004: Audit Logs & Job Moderation Schema (Cụm 11)
-- ============================================================

-- 1. Tạo bảng audit_logs lưu trữ lịch sử kiểm toán của Admin
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  details TEXT, -- JSON payload lưu trữ chi tiết thay đổi
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bổ sung cột an toàn cho CSDL PostgreSQL / SQLite đã tồn tại
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- 2. Đảm bảo bảng jobs có đầy đủ cột status và moderation_status
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending';

-- 3. Tạo Indexes tối ưu hóa truy vấn audit log và job status
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_moderation_status ON jobs(moderation_status);
