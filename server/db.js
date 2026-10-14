import "dotenv/config";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { initialJobs } from "../shared/data/initialJobs.js";
import { initialFreelance } from "../shared/data/initialFreelance.js";
import { initialGigs } from "../shared/data/initialGigs.js";

const { Pool, types } = pg;

// Parse int8 (bigint/COUNT/SUM) and numeric (decimal/AVG) as native JS numbers
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL Connection String & Pool Configuration
const connectionString = process.env.DATABASE_URL;
const useSSL =
  process.env.DATABASE_SSL === "true" ||
  (connectionString && connectionString.includes("sslmode=require"));
// Mặc định bảo mật: Luôn xác thực chứng chỉ CA của máy chủ DB (ngoại trừ khi cố ý đặt DATABASE_SSL_REJECT_UNAUTHORIZED=false)
const rejectUnauthorized =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

let caCert = process.env.DATABASE_CA_CERT || null;
if (
  !caCert &&
  process.env.DATABASE_CA_CERT_PATH &&
  fs.existsSync(process.env.DATABASE_CA_CERT_PATH)
) {
  try {
    caCert = fs.readFileSync(process.env.DATABASE_CA_CERT_PATH, "utf8");
  } catch (err) {
    console.warn(
      "[PostgreSQL SSL] Không thể đọc file CA từ DATABASE_CA_CERT_PATH:",
      err.message,
    );
  }
}

const sslConfig = useSSL
  ? {
      rejectUnauthorized,
      ...(caCert ? { ca: caCert } : {}),
    }
  : false;

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: sslConfig,
    }
  : {
      host: process.env.PGHOST || "localhost",
      port: parseInt(process.env.PGPORT, 10) || 5432,
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "postgres",
      database: process.env.PGDATABASE || "worklink",
      ssl: sslConfig,
    };

poolConfig.max = parseInt(process.env.PG_POOL_MAX, 10) || 20;
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis =
  parseInt(process.env.PG_CONNECTION_TIMEOUT, 10) || 30000;

export const pool = new Pool(poolConfig);
export const db = pool; // Backward-compatibility alias

pool.on("error", (err) => {
  console.error("[PostgreSQL Pool Unexpected Error]:", err.message);
});

let resolveDbReady;
export const dbReady = new Promise((resolve) => {
  resolveDbReady = resolve;
});

/**
 * Chuyển đổi tham số truy vấn '?' thành biến định danh PostgreSQL '$1, $2, ...'
 * Đồng thời tự động tương thích cú pháp INSERT OR IGNORE -> ON CONFLICT DO NOTHING
 */
export function formatSql(sql) {
  let transformed = sql;

  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(transformed)) {
    transformed = transformed.replace(
      /INSERT\s+OR\s+IGNORE\s+INTO/i,
      "INSERT INTO",
    );
    if (!/ON\s+CONFLICT/i.test(transformed)) {
      transformed += " ON CONFLICT DO NOTHING";
    }
  }

  let paramIdx = 0;
  return transformed.replace(/\?/g, () => `$${++paramIdx}`);
}

/**
 * Thực thi câu lệnh SELECT trả về mảng các dòng bản ghi
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<Array>}
 */
export const query = async (sql, params = []) => {
  const pgSql = formatSql(sql);
  const result = await pool.query(pgSql, params);
  return result.rows;
};

/**
 * Thực thi câu lệnh SELECT lấy 1 dòng bản ghi đầu tiên hoặc null
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<Object|null>}
 */
export const get = async (sql, params = []) => {
  const pgSql = formatSql(sql);
  const result = await pool.query(pgSql, params);
  return result.rows[0] || null;
};

/**
 * Thực thi câu lệnh INSERT / UPDATE / DELETE
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<{ changes: number, rowCount: number, lastID: any }>}
 */
export const run = async (sql, params = []) => {
  const pgSql = formatSql(sql);
  const result = await pool.query(pgSql, params);
  return {
    changes: result.rowCount || 0,
    rowCount: result.rowCount || 0,
    lastID: result.rows?.[0]?.id || null,
  };
};

/**
 * Khởi tạo cơ sở dữ liệu PostgreSQL (schema.sql & seedInitialData)
 */
export async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log("✅ Đã kết nối thành công tới cơ sở dữ liệu PostgreSQL!");

    try {
      // 1. Migration an toàn cho DB đã tồn tại trước khi tạo indexes
      try {
        await client.query(`
          ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS employer_id TEXT;
          ALTER TABLE gig_tasks ADD COLUMN IF NOT EXISTS employer_id TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS full_address TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled INTEGER DEFAULT 0;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_quota_used INTEGER DEFAULT 0;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_quota_reset_date TEXT;
          ALTER TABLE applications ADD COLUMN IF NOT EXISTS cv_file_path TEXT;
          ALTER TABLE jobs ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved';
          ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
          ALTER TABLE jobs ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_read INTEGER DEFAULT 0;
          ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS cv_name TEXT;
          ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS ats_score INTEGER;
          ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS summary TEXT;
          ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS strengths TEXT;
          ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS improvements TEXT;
          ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS breakdown TEXT;
          ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS matched_jobs TEXT;
          ALTER TABLE cv_analyses ALTER COLUMN match_score DROP NOT NULL;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_quota INTEGER DEFAULT 5;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE applications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE cv_analyses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
          UPDATE users SET ai_quota = 5 WHERE ai_quota IS NULL;
          UPDATE jobs SET status = 'active' WHERE status IS NULL;
          CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            admin_id TEXT,
            action TEXT NOT NULL,
            target_id TEXT,
            details TEXT,
            ip_address TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_id TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
          CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
          CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
          CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
          CREATE INDEX IF NOT EXISTS idx_applications_deleted_at ON applications(deleted_at);
          CREATE INDEX IF NOT EXISTS idx_cv_analyses_deleted_at ON cv_analyses(deleted_at);
          CREATE INDEX IF NOT EXISTS idx_jobs_fts ON jobs USING gin(to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(company, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(district, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(requirements, '') || ' ' || COALESCE(hashtags, '')));
        `);
      } catch (migErr) {
        // Có thể bảng chưa tồn tại trong lần đầu chạy, sẽ được schema.sql tạo
      }

      const schemaPath = path.join(__dirname, "..", "database", "schema.sql");
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, "utf8");
        await client.query(schemaSql);
        console.log("✅ Khởi tạo Schema PostgreSQL thành công");
      }

      await seedInitialData();
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(
      "❌ [PostgreSQL] Không thể kết nối cơ sở dữ liệu PostgreSQL!",
    );
    console.error("   Lỗi chi tiết:", err.message);
    console.log("\n💡 Để mở ứng dụng trên Chrome với PostgreSQL 100%:");
    console.log(
      "   - Cách 1 (Khuyên dùng - 30 giây): Dùng Cloud DB miễn phí tại https://neon.tech rồi dán link vào file .env:",
    );
    console.log(
      '     DATABASE_URL="postgresql://user:pass@ep-cool-fog.neon.tech/neondb?sslmode=require"',
    );
    console.log("   - Cách 2: Khởi động container PostgreSQL qua Docker:");
    console.log("     docker compose up -d postgres");
    console.log("   - Cách 3: Bật PostgreSQL cục bộ tại localhost:5432\n");
    console.warn(
      "⚠️  Server sẽ khởi động ở chế độ hạn chế (Degraded Mode). Tính năng không cần DB (AI, CV, Sàn ngoài) vẫn hoạt động.",
    );
    // Không exit — cho phép server chạy ở degraded mode
  } finally {
    resolveDbReady();
  }
}

// Khởi chạy kết nối ngay khi module được import
initDatabase();

export const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

export async function seedInitialData(force = false) {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && process.env.ALLOW_PRODUCTION_SEED !== "true") {
      console.log(
        "[Seed] Đang ở môi trường Production: Tự động bỏ qua seed tài khoản demo để bảo mật (bật ALLOW_PRODUCTION_SEED=true nếu cần khởi tạo).",
      );
      return;
    }

    if (
      isProduction &&
      (!process.env.SEED_DEFAULT_PASSWORD ||
        !process.env.ADMIN_INITIAL_PASSWORD)
    ) {
      if (
        process.env.REQUIRE_SECURE_ENV === "true" ||
        process.env.STRICT_SECURITY === "true"
      ) {
        console.error(
          "❌ [BẢO MẬT BẮT BUỘC] Chưa thiết lập SEED_DEFAULT_PASSWORD và ADMIN_INITIAL_PASSWORD cho môi trường Production!",
        );
        process.exit(1);
      } else {
        console.warn(
          '⚠️ [CẢNH BÁO BẢO MẬT] Mật khẩu seed người dùng đang sử dụng giá trị mặc định ("123456"). Hãy cấu hình SEED_DEFAULT_PASSWORD và ADMIN_INITIAL_PASSWORD trong biến môi trường Production!',
        );
      }
    }

    const defaultPassword = await bcrypt.hash(
      process.env.SEED_DEFAULT_PASSWORD || "123456",
      BCRYPT_ROUNDS,
    );
    const adminPassword = await bcrypt.hash(
      process.env.ADMIN_INITIAL_PASSWORD ||
        process.env.SEED_DEFAULT_PASSWORD ||
        "123456",
      BCRYPT_ROUNDS,
    );

    // 1. Seed Users
    if (force) {
      await run("DELETE FROM users");
    }
    const existingUsers = await query("SELECT COUNT(*) as count FROM users");
    if (!existingUsers[0]?.count || existingUsers[0].count === 0 || force) {
      const usersToInsert = [
        // Candidates - Duy nhất tài khoản ứng viên Nguyễn Minh Anh
        [
          "user-seeker-1",
          "Nguyễn Minh Anh",
          "minhanh.student@gmail.com",
          defaultPassword,
          "job_seeker",
          "0988 123 456",
          "Cầu Giấy",
          "Sinh viên ĐHQGHN",
          "CV_NguyenMinhAnh_WorkLink.pdf",
        ],

        // Employers
        [
          "user-employer-1",
          "The Coffee Lab & Bistro",
          "hr@thecoffeelab.vn",
          defaultPassword,
          "employer",
          "0912 345 678",
          "Cầu Giấy",
          "Chuỗi Cà phê & Bistro hiện đại",
          null,
        ],
        [
          "user-employer-2",
          "NextGen Tech Solutions",
          "hr@nextgentech.vn",
          defaultPassword,
          "employer",
          "0983 888 999",
          "Cầu Giấy",
          "Công ty Giải pháp Công nghệ Phần mềm",
          null,
        ],
        [
          "user-employer-3",
          "VinaFintech Digital",
          "tuyendung@vinafintech.vn",
          defaultPassword,
          "employer",
          "0904 112 233",
          "Nam Từ Liêm",
          "Tập đoàn Công nghệ Tài chính Số",
          null,
        ],
        [
          "user-employer-4",
          "Urban Threads Studio",
          "contact@urbanthreads.vn",
          defaultPassword,
          "employer",
          "0936 555 777",
          "Hai Bà Trưng",
          "Thương hiệu Thời trang Streetwear",
          null,
        ],
        [
          "user-employer-5",
          "Media Pulse Agency",
          "hr@mediapulse.vn",
          defaultPassword,
          "employer",
          "0977 223 344",
          "Thanh Xuân",
          "Agency Truyền thông & Digital Marketing",
          null,
        ],
        [
          "user-employer-6",
          "Trung tâm Gia sư Khởi Sáng",
          "giasukhoisang@gmail.com",
          defaultPassword,
          "employer",
          "0966 889 900",
          "Cầu Giấy",
          "Hệ thống Gia sư & Bồi dưỡng Văn hóa",
          null,
        ],
        [
          "user-employer-7",
          "FastLogistics Express",
          "recruitment@fastlogistics.vn",
          defaultPassword,
          "employer",
          "0944 667 788",
          "Hoàng Mai",
          "Công ty Vận chuyển & Kho vận Thương mại Điện tử",
          null,
        ],

        // Admin
        [
          "user-admin-1",
          "Admin Quản Trị",
          "admin@worklink.vn",
          adminPassword,
          "admin",
          "0999 999 999",
          "Hà Nội",
          "Hệ thống Quản trị WorkLink",
          null,
        ],
      ];

      for (const u of usersToInsert) {
        await run(
          `
          INSERT INTO users (id, name, email, password_hash, role, phone, district, title, cv_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            phone = EXCLUDED.phone,
            district = EXCLUDED.district,
            title = EXCLUDED.title,
            cv_name = EXCLUDED.cv_name
        `,
          u,
        );
      }
      console.log(
        `✅ Đã seed ${usersToInsert.length} tài khoản người dùng vào PostgreSQL`,
      );
    }

    // 2. Seed Jobs
    if (force) {
      await run("DELETE FROM jobs");
    }
    const existingJobs = await query("SELECT COUNT(*) as count FROM jobs");
    if (!existingJobs[0]?.count || existingJobs[0].count === 0 || force) {
      for (const j of initialJobs) {
        await run(
          `
          INSERT INTO jobs (
            id, employer_id, title, company, company_logo, category, district, city, address,
            salary_display, salary_type, salary_min, salary_max, job_type, time_shift,
            time_hours, experience, description, requirements, benefits, slots, deadline,
            hashtags, is_hot, is_pinned, views, likes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO NOTHING
        `,
          [
            j.id,
            j.employerId || j.employer_id || "user-employer-1",
            j.title,
            j.company,
            j.companyLogo || "💼",
            j.category,
            j.district,
            j.city || "Hà Nội",
            j.address || `${j.district}, Hà Nội`,
            j.salaryDisplay,
            j.salaryType || "hourly",
            j.salaryMin || 30000,
            j.salaryMax || 40000,
            j.jobType || "PART_TIME",
            j.timeShift || "Tối",
            j.timeHours || "17:30 - 22:30",
            j.experience || "NO_EXPERIENCE",
            j.description,
            JSON.stringify(j.requirements || []),
            JSON.stringify(j.benefits || []),
            j.slots || 2,
            j.deadline || "2026-10-30",
            j.hashtags ? j.hashtags.join(" ") : "",
            j.isHot ? 1 : 0,
            j.isPinned ? 1 : 0,
            j.views || 10,
            j.likes || 5,
          ],
        );
      }
      console.log(
        `✅ Đã seed ${initialJobs.length} công việc vào bảng jobs PostgreSQL`,
      );
    }

    // 3. Seed Applications
    if (force) {
      await run("DELETE FROM applications");
    }
    const existingApps = await query(
      "SELECT COUNT(*) as count FROM applications",
    );
    if (!existingApps[0]?.count || existingApps[0].count === 0 || force) {
      const sampleApplications = [
        [
          "app-1",
          "job-1",
          "user-seeker-1",
          "Nguyễn Minh Anh",
          "0988 123 456",
          "minhanh.student@gmail.com",
          "Em có thể làm từ 17h30 các ngày thứ 2, 4, 6 và chủ nhật ạ.",
          "CV_NguyenMinhAnh_WorkLink.pdf",
          "interview",
        ],
        [
          "app-2",
          "job-2",
          "user-seeker-1",
          "Nguyễn Minh Anh",
          "0988 123 456",
          "minhanh.student@gmail.com",
          "Em đã có kinh nghiệm làm barista bán thời gian 6 tháng tại quán cà phê.",
          "CV_NguyenMinhAnh_WorkLink.pdf",
          "reviewed",
        ],
        [
          "app-3",
          "job-4",
          "user-seeker-1",
          "Nguyễn Minh Anh",
          "0988 123 456",
          "minhanh.student@gmail.com",
          "Em đã học và làm qua dự án cá nhân với React và Tailwind, rất mong được học hỏi thêm.",
          "CV_NguyenMinhAnh_WorkLink.pdf",
          "pending",
        ],
        [
          "app-4",
          "job-8",
          "user-seeker-1",
          "Nguyễn Minh Anh",
          "0988 123 456",
          "minhanh.student@gmail.com",
          "Em yêu thích thời trang streetwear và có thể sắp xếp đi làm ca chiều tất cả các ngày ạ.",
          "CV_NguyenMinhAnh_WorkLink.pdf",
          "interview",
        ],
        [
          "app-5",
          "job-6",
          "user-seeker-1",
          "Nguyễn Minh Anh",
          "0988 123 456",
          "minhanh.student@gmail.com",
          "Em có kinh nghiệm ReactJS cơ bản và rất mong muốn được thực tập học hỏi tại công ty.",
          "CV_NguyenMinhAnh_WorkLink.pdf",
          "pending",
        ],
      ];

      for (const app of sampleApplications) {
        await run(
          `
          INSERT INTO applications (id, job_id, user_id, applicant_name, phone, email, note, cv_name, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO NOTHING
        `,
          app,
        );
      }
      console.log(
        `✅ Đã seed ${sampleApplications.length} đơn ứng tuyển mẫu vào PostgreSQL`,
      );
    }

    // 4. Seed Freelance Projects if empty
    if (force) {
      await run("DELETE FROM freelance_projects");
    }
    const existingFl = await query(
      "SELECT COUNT(*) as count FROM freelance_projects",
    );
    if (!existingFl[0]?.count || existingFl[0].count === 0 || force) {
      for (const p of initialFreelance) {
        await run(
          `
          INSERT INTO freelance_projects (
            id, employer_id, title, client, budget, budget_num, duration, category, skills, description, deadline, hashtags, proposals_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO NOTHING
        `,
          [
            p.id,
            p.employerId || "user-employer-1",
            p.title,
            p.client,
            p.budget,
            p.budgetNum || 5000000,
            p.duration,
            p.category,
            p.skills ? p.skills.join(", ") : "",
            p.description,
            p.deadline,
            p.hashtags ? p.hashtags.join(" ") : "",
            p.proposalsCount || 0,
          ],
        );
      }
      console.log(
        `✅ Đã seed ${initialFreelance.length} dự án Freelance vào PostgreSQL`,
      );
    }

    // 5. Seed Gigs if empty
    if (force) {
      await run("DELETE FROM gig_tasks");
    }
    const existingGigs = await query("SELECT COUNT(*) as count FROM gig_tasks");
    if (!existingGigs[0]?.count || existingGigs[0].count === 0 || force) {
      for (const g of initialGigs) {
        await run(
          `
          INSERT INTO gig_tasks (
            id, employer_id, title, reward, reward_num, time_needed, cargo_type, is_valuable, requires_contract,
            pickup_name, pickup_address, pickup_lat, pickup_lng,
            dropoff_name, dropoff_address, dropoff_lat, dropoff_lng,
            distance_km, note, sender, receiver, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET employer_id = COALESCE(gig_tasks.employer_id, EXCLUDED.employer_id)
        `,
          [
            g.id,
            g.employerId || g.employer_id || "user-employer-1",
            g.title,
            g.reward,
            g.rewardNum || 50000,
            g.time,
            g.cargoType,
            g.isValuable ? 1 : 0,
            g.requiresContract ? 1 : 0,
            g.pickupLocation.name,
            g.pickupLocation.address || g.pickupLocation.name,
            g.pickupLocation.lat,
            g.pickupLocation.lng,
            g.dropoffLocation.name,
            g.dropoffLocation.address || g.dropoffLocation.name,
            g.dropoffLocation.lat,
            g.dropoffLocation.lng,
            g.distanceKm || 5.0,
            g.note || "",
            g.sender || "",
            g.receiver || "",
            g.status || "AVAILABLE",
          ],
        );
      }
      // Đảm bảo các cuốc việc vặt mẫu có employer_id
      await run(
        "UPDATE gig_tasks SET employer_id = 'user-employer-1' WHERE employer_id IS NULL",
      );
      console.log(
        `✅ Đã seed ${initialGigs.length} việc vặt bản đồ vào PostgreSQL`,
      );
    }
  } catch (err) {
    console.error("Lỗi khi seed data PostgreSQL:", err.message);
  }
}
