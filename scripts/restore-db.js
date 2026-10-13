import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');

// Cấu hình Database Pool
const connectionString = process.env.DATABASE_URL;
const useSSL = process.env.DATABASE_SSL === 'true' || (connectionString && connectionString.includes('sslmode=require'));
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

let caCert = process.env.DATABASE_CA_CERT || null;
if (!caCert && process.env.DATABASE_CA_CERT_PATH && fs.existsSync(process.env.DATABASE_CA_CERT_PATH)) {
  try {
    caCert = fs.readFileSync(process.env.DATABASE_CA_CERT_PATH, 'utf8');
  } catch {}
}

const sslConfig = useSSL
  ? { rejectUnauthorized, ...(caCert ? { ca: caCert } : {}) }
  : false;

const poolConfig = connectionString
  ? { connectionString, ssl: sslConfig }
  : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT, 10) || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'worklink',
      ssl: sslConfig
    };

/**
 * Tìm file backup mới nhất trong thư mục backups/
 */
function getLatestBackupFile() {
  if (!fs.existsSync(BACKUPS_DIR)) return null;
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('worklink_backup_') && f.endsWith('.sql'))
    .sort()
    .reverse();

  return files.length > 0 ? path.join(BACKUPS_DIR, files[0]) : null;
}

async function runRestore() {
  console.log(`=========================================`);
  console.log(`🔄 WORKLINK DATABASE RESTORE UTILITY`);
  console.log(`=========================================`);

  let targetFile = process.argv[2];
  if (!targetFile) {
    targetFile = getLatestBackupFile();
    if (!targetFile) {
      console.error(`❌ Không tìm thấy bản sao lưu nào trong thư mục backups/!`);
      console.log(`Cách dùng: node scripts/restore-db.js [duong_dan_file.sql]`);
      process.exit(1);
    }
    console.log(`ℹ️ Không chỉ định file, tự động chọn bản mới nhất: ${path.basename(targetFile)}`);
  } else if (!fs.existsSync(targetFile)) {
    console.error(`❌ File sao lưu không tồn tại: ${targetFile}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(targetFile, 'utf8');
  console.log(`📖 Đã đọc file backup (${(sqlContent.length / 1024).toFixed(1)} KB)`);

  const pool = new Pool(poolConfig);
  const client = await pool.connect();

  try {
    console.log(`⚡ Đang tiến hành khôi phục CSDL...`);
    await client.query(sqlContent);
    console.log(`🎉 Khôi phục cơ sở dữ liệu thành công từ: ${path.basename(targetFile)}!`);
    console.log(`=========================================`);
  } catch (err) {
    console.error(`❌ Lỗi khi khôi phục cơ sở dữ liệu:`, err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runRestore();
