import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;

console.log('\x1b[36m%s\x1b[0m', '==================================================');
console.log('\x1b[36m%s\x1b[0m', '🚀 WORKLINK FULLSTACK RUNNER (CROSS-PLATFORM)');
console.log('\x1b[36m%s\x1b[0m', '==================================================\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// 1. Khởi động Backend API Server (Port 5000)
const server = spawn('node', ['server/index.js'], {
  cwd: rootDir,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: isWindows
});

server.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.log('\x1b[32m[Backend]\x1b[0m ' + l);
  });
});

server.stderr.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.error('\x1b[31m[Backend Err]\x1b[0m ' + l);
  });
});

// 2. Khởi động Frontend Vite (Port 5173)
const client = spawn(npmCmd, ['run', 'dev', '--', '--host'], {
  cwd: rootDir,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: isWindows
});

client.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.log('\x1b[34m[Frontend]\x1b[0m ' + l);
  });
});

client.stderr.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.error('\x1b[33m[Frontend]\x1b[0m ' + l);
  });
});

// Dọn dẹp tiến trình con khi dừng
const cleanup = () => {
  console.log('\n\x1b[33m[Runner] Đang tắt các tiến trình máy chủ...\x1b[0m');
  try {
    if (isWindows) {
      if (server.pid) spawn('taskkill', ['/pid', server.pid.toString(), '/f', '/t']);
      if (client.pid) spawn('taskkill', ['/pid', client.pid.toString(), '/f', '/t']);
    } else {
      server.kill('SIGTERM');
      client.kill('SIGTERM');
    }
  } catch (_) {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
