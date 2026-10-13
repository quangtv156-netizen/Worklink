#!/usr/bin/env node
import 'dotenv/config';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { runAuthTests } from './auth.test.js';
import { runSecurityTests } from './security.test.js';
import { runRBACTests } from './rbac.test.js';
import { runJobTests } from './jobs.test.js';
import { runAuditFixesTests } from './new_audit_fixes.test.js';
import { runConcurrencyTests } from './concurrency.test.js';
import { runChatSecurityTests } from './chat-security.test.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

async function isServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(maxRetries = 100) {
  for (let i = 0; i < maxRetries; i++) {
    if (await isServerRunning()) return true;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  console.log('====================================================');
  console.log('🚀 WORKLINK AUTOMATED TEST SUITE (INTEGRATION & UNIT)');
  console.log('====================================================');
  console.log(`Kiểm tra API Server tại: ${BASE_URL}`);

  let serverProcess = null;
  const running = await isServerRunning();

  if (!running) {
    console.log('-> Server chưa chạy. Đang khởi động máy chủ kiểm thử...');
    serverProcess = spawn('node', ['server/index.js'], {
      cwd: rootDir,
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test', RATE_LIMIT_DISABLED: 'false' },
      stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (d) => process.stdout.write(d));
    serverProcess.stderr.on('data', (d) => process.stderr.write(d));

    const ready = await waitForServer();
    if (!ready) {
      console.error('❌ Không thể khởi động máy chủ kiểm thử sau 30 giây.');
      if (serverProcess) {
        if (process.platform === 'win32' && serverProcess.pid) {
          spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t']);
        } else {
          serverProcess.kill();
        }
      }
      process.exit(1);
    }
    console.log('-> Máy chủ kiểm thử đã sẵn sàng!');
  } else {
    console.log('-> Đã phát hiện máy chủ đang hoạt động, tiến hành kiểm thử trực tiếp.');
  }

  const startTime = Date.now();
  let totalTestsPassed = 0;

  try {
    // Suite 1: Authentication & Password Security
    await runAuthTests(BASE_URL);
    totalTestsPassed += 11;

    // Suite 2: Security Infrastructure (Helmet, CORS, Rate Limit, CSRF, BullMQ Worker)
    await runSecurityTests(BASE_URL);
    totalTestsPassed += 6;

    // Suite 3: Role-based Access Control & Privacy
    await runRBACTests(BASE_URL);
    totalTestsPassed += 5;

    // Suite 4: Jobs & Applications Lifecycle
    await runJobTests(BASE_URL);
    totalTestsPassed += 6;

    // Suite 5: Critical & High Vulnerability Audit Fixes & PDPA / AI Quota / Cụm 11
    await runAuditFixesTests(BASE_URL);
    totalTestsPassed += 17;

    // Suite 6: Race Condition dưới request đồng thời thật (Promise.all)
    await runConcurrencyTests(BASE_URL);
    totalTestsPassed += 2;

    // Suite 7: Bảo mật Chat REST API (IDOR)
    await runChatSecurityTests(BASE_URL);
    totalTestsPassed += 5;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n====================================================');
    console.log(`🎉 TẤT CẢ CÁC BÀI KIỂM THỬ TỰ ĐỘNG ĐÃ VƯỢT QUA! (${duration}s)`);
    console.log(`📊 Tổng số tiêu chí kiểm tra thành công: ${totalTestsPassed} PASS / 0 FAIL`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ BÀI KIỂM THỬ THẤT BẠI:', err);
    process.exitCode = 1;
  } finally {
    if (serverProcess) {
      if (process.platform === 'win32' && serverProcess.pid) {
        spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t']);
      } else {
        serverProcess.kill();
      }
    }
  }
}

main().catch(err => {
  console.error('Lỗi thực thi test suite:', err);
  process.exit(1);
});
