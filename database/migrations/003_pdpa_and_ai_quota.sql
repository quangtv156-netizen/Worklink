-- ========================================================
-- MIGRATION: 003_pdpa_and_ai_quota.sql
-- Thêm cơ chế Soft Delete (PDPA/GDPR) & Quản trị AI Quota
-- ========================================================

-- 1. Bổ sung trường ai_quota và deleted_at vào bảng users
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_quota INTEGER DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. Cập nhật quota mặc định cho các người dùng hiện có
UPDATE users SET ai_quota = 5 WHERE ai_quota IS NULL;

-- 3. Bổ sung trường deleted_at vào bảng applications (Job Apply)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 4. Bổ sung trường deleted_at vào bảng cv_analyses (Hồ sơ CV)
ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 5. Tạo các index tối ưu hóa cho truy vấn Soft Delete
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_applications_deleted_at ON applications(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cv_analyses_deleted_at ON cv_analyses(deleted_at);
