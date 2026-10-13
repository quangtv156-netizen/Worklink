#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('🔑 WORKLINK PRODUCTION CREDENTIALS GENERATOR');
console.log('====================================================');

const jwtSecret = crypto.randomBytes(32).toString('hex');
const dbPassword = crypto.randomBytes(24).toString('base64url');
const adminPassword = crypto.randomBytes(16).toString('base64url') + '!A1';
const seedPassword = crypto.randomBytes(16).toString('base64url') + '!S1';

console.log('Đã tạo thành công bộ thông tin xác thực an toàn cho Production:\n');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`POSTGRES_PASSWORD=${dbPassword}`);
console.log(`DATABASE_URL=postgresql://postgres:${dbPassword}@postgres:5432/worklink`);
console.log(`ADMIN_INITIAL_PASSWORD=${adminPassword}`);
console.log(`SEED_DEFAULT_PASSWORD=${seedPassword}\n`);

const args = process.argv.slice(2);
const shouldWrite = args.includes('--write') || args.includes('-w');

if (shouldWrite) {
  const targetEnvFile = path.join(rootDir, '.env');
  const template = `# ========================================================
# WORKLINK PRODUCTION ENVIRONMENT (.env)
# Tự động sinh bởi: npm run secret:generate -- --write
# ========================================================
PORT=5000
NODE_ENV=production
VITE_API_URL=http://localhost:5000

# Cơ sở dữ liệu PostgreSQL (Mật khẩu bảo mật cao)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${dbPassword}
POSTGRES_DB=worklink
DATABASE_URL=postgresql://postgres:${dbPassword}@127.0.0.1:5432/worklink

# Bảo mật JWT
JWT_SECRET=${jwtSecret}
BCRYPT_ROUNDS=12

# Mật khẩu khởi tạo
ADMIN_INITIAL_PASSWORD=${adminPassword}
SEED_DEFAULT_PASSWORD=${seedPassword}

# CORS & CSP
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:5173
ENABLE_CSP=true
`;

  if (!fs.existsSync(targetEnvFile)) {
    fs.writeFileSync(targetEnvFile, template, 'utf8');
    console.log(`✅ Đã tự động tạo file .env tại thư mục gốc với các thông số an toàn trên!`);
  } else {
    console.log(`ℹ️ File .env đã tồn tại. Để tránh ghi đè cấu hình hiện tại, hãy sao chép các dòng trên vào .env.`);
  }
} else {
  console.log('💡 Hướng dẫn cấu hình:');
  console.log('1. Sao chép các biến trên và dán vào file .env trên máy chủ production hoặc Docker.');
  console.log('2. Hoặc chạy lệnh: "npm run secret:generate -- --write" để tự động tạo file .env mẫu.');
  console.log('3. Đảm bảo file .env KHÔNG bao giờ được đưa lên Git.');
}
console.log('====================================================');

