/**
 * WorkLink Database Migration Runner
 * Đảm bảo các migration .sql trong database/migrations/ được thực thi theo thứ tự phiên bản
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/worklink';
const migrationsDir = path.resolve(__dirname, '..', 'database', 'migrations');

async function runMigrations() {
  console.log('🔄 Đang kết nối CSDL để kiểm tra migrations...');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const client = await pool.connect();
    try {
      // 1. Tạo bảng quản lý migrations nếu chưa tồn tại
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          version VARCHAR(255) UNIQUE NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Lấy danh sách migration đã chạy
      const { rows: appliedRows } = await client.query('SELECT version FROM schema_migrations;');
      const appliedSet = new Set(appliedRows.map(r => r.version));

      // 3. Đọc các file migration theo thứ tự
      if (!fs.existsSync(migrationsDir)) {
        console.log('⚠️ Thư mục migrations không tồn tại:', migrationsDir);
        return;
      }

      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      console.log(`📁 Tìm thấy ${files.length} file migrations trong database/migrations/`);

      for (const file of files) {
        if (appliedSet.has(file)) {
          console.log(`  ⏩ Bỏ qua (đã chạy): ${file}`);
          continue;
        }

        console.log(`  🚀 Đang áp dụng migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1);', [file]);
          await client.query('COMMIT');
          console.log(`  ✅ Hoàn tất migration: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`  ❌ Lỗi khi chạy migration ${file}:`, err.message);
          throw err;
        }
      }

      console.log('🎉 Toàn bộ migrations đã được cập nhật thành công!');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Lỗi chạy database migrations:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
