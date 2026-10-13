import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');

const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 7;

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

function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Xóa các file backup cũ hơn RETENTION_DAYS (mặc định 7 ngày)
 */
function cleanOldBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return;
  const now = Date.now();
  const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
  
  const files = fs.readdirSync(BACKUPS_DIR);
  let removedCount = 0;

  files.forEach(file => {
    if (!file.startsWith('worklink_backup_') && !file.startsWith('uploads_backup_')) return;
    const filePath = path.join(BACKUPS_DIR, file);
    try {
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAgeMs) {
        if (stats.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
        removedCount++;
      }
    } catch {}
  });

  if (removedCount > 0) {
    console.log(`🧹 [Retention Policy] Đã dọn dẹp ${removedCount} bản sao lưu cũ (> ${RETENTION_DAYS} ngày).`);
  }
}

/**
 * Sao lưu thư mục tệp đính kèm uploads/ (CVs & avatars)
 */
function backupUploads(timestamp) {
  const uploadsDir = path.join(ROOT_DIR, 'uploads');
  if (!fs.existsSync(uploadsDir)) return;
  const targetUploadsBackupDir = path.join(BACKUPS_DIR, `uploads_backup_${timestamp}`);
  try {
    fs.cpSync(uploadsDir, targetUploadsBackupDir, { recursive: true });
    console.log(`📁 Đã sao lưu thư mục uploads: backups/uploads_backup_${timestamp}`);
  } catch (err) {
    console.warn(`⚠️ Cảnh báo sao lưu uploads:`, err.message);
  }
}

/**
 * Backup dữ liệu trực tiếp bằng Node.js pg client (Portable, chạy được trên mọi server không cần pg_dump)
 */
async function fallbackNodeBackup(pool, targetFilePath) {
  const client = await pool.connect();
  const writeStream = fs.createWriteStream(targetFilePath, { encoding: 'utf8' });

  try {
    writeStream.write(`-- WORKLINK DATABASE BACKUP\n`);
    writeStream.write(`-- Created: ${new Date().toISOString()}\n`);
    writeStream.write(`-- Server Environment: ${process.env.NODE_ENV || 'production'}\n\n`);
    writeStream.write(`BEGIN;\n\n`);

    // Lấy schema.sql gốc nếu có
    const schemaPath = path.join(ROOT_DIR, 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      writeStream.write(`-- SCHEMA DEFINITIONS\n`);
      writeStream.write(fs.readFileSync(schemaPath, 'utf8'));
      writeStream.write(`\n\n`);
    }

    // Lấy danh sách các bảng public
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`📦 Bắt đầu sao lưu ${tableNames.length} bảng: ${tableNames.join(', ')}`);

    for (const table of tableNames) {
      const rowsRes = await client.query(`SELECT * FROM "${table}"`);
      const rows = rowsRes.rows;
      if (rows.length === 0) continue;

      writeStream.write(`-- Data for table: ${table} (${rows.length} rows)\n`);
      for (const row of rows) {
        const columns = Object.keys(row).map(c => `"${c}"`).join(', ');
        const values = Object.values(row).map(v => {
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number' || typeof v === 'boolean') return v;
          if (v instanceof Date) return `'${v.toISOString()}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');

        writeStream.write(`INSERT INTO "${table}" (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`);
      }
      writeStream.write(`\n`);
    }

    writeStream.write(`COMMIT;\n`);
    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    return true;
  } finally {
    client.release();
  }
}

async function runBackup() {
  console.log(`=========================================`);
  console.log(`💾 WORKLINK DATABASE BACKUP UTILITY`);
  console.log(`📅 Thời gian: ${new Date().toLocaleString()}`);
  console.log(`=========================================`);

  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = formatTimestamp();
  const backupFileName = `worklink_backup_${timestamp}.sql`;
  const backupFilePath = path.join(BACKUPS_DIR, backupFileName);

  const pool = new Pool(poolConfig);

  try {
    // Thử kết nối DB
    await pool.query('SELECT 1');
    console.log(`✅ Kết nối Database thành công.`);

    // Thực hiện backup CSDL
    await fallbackNodeBackup(pool, backupFilePath);

    const stats = fs.statSync(backupFilePath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log(`\n🎉 Sao lưu CSDL thành công!`);
    console.log(`📁 File: backups/${backupFileName}`);
    console.log(`📊 Dung lượng: ${sizeKB} KB`);

    // Thực hiện sao lưu thư mục uploads/
    backupUploads(timestamp);

    cleanOldBackups();
    console.log(`=========================================`);
  } catch (err) {
    console.error(`❌ Lỗi sao lưu CSDL:`, err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runBackup();
