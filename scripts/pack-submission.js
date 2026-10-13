import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-ssr',
  '.gemini',
  '.tempmediaStorage',
  '.user_uploaded',
  'scratch',
  'temp_pack_submission',
  'tmp',
  'uploads',
  'test-results',
  'playwright-report',
  'backups'
]);

const EXCLUDE_FILES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  'worklink.sqlite',
  'worklink.sqlite-journal',
  'WorkLink_Submission.zip'
]);

function shouldExclude(relPath) {
  const parts = relPath.split(path.sep);
  for (const part of parts) {
    if (EXCLUDE_DIRS.has(part)) return true;
  }
  const basename = path.basename(relPath);
  if (basename.startsWith('.env') && !basename.endsWith('.example')) return true;
  if (basename.endsWith('.sqlite') || basename.endsWith('.sqlite-journal') || basename.endsWith('.log') || basename.endsWith('.zip') || basename.endsWith('.tar.gz')) return true;
  return false;
}

function copyDirRecursive(src, dest, base = '') {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const rel = path.join(base, entry.name);
    if (shouldExclude(rel)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, rel);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('====================================================');
console.log('📦 BẮT ĐẦU ĐÓNG GÓI BÀI NỘP WORKLINK SẠCH SẼ (ZIP)');
console.log('====================================================');

const tempDir = path.join(os.tmpdir(), `worklink_pack_${Date.now()}`);
const zipOutput = path.join(rootDir, 'WorkLink_Submission.zip');

try {
  // 1. Dọn dẹp zip cũ và temp cũ
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  if (fs.existsSync(zipOutput)) fs.unlinkSync(zipOutput);

  // 2. Sao chép cây thư mục sạch (bỏ qua node_modules, .env, local db/logs, ...)
  console.log('-> Đang lọc và sao chép mã nguồn (loại trừ node_modules, .env, dist, git)...');
  copyDirRecursive(rootDir, tempDir);

  // 3. Nén file zip
  console.log('-> Đang tạo file nén: WorkLink_Submission.zip ...');
  if (process.platform === 'win32') {
    const escapedTemp = tempDir.replace(/'/g, "''");
    const escapedZip = zipOutput.replace(/'/g, "''");
    const psCmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; Add-Type -AssemblyName System.IO.Compression; $zip = [System.IO.Compression.ZipFile]::Open('${escapedZip}', [System.IO.Compression.ZipArchiveMode]::Create); Get-ChildItem -Path '${escapedTemp}' -Recurse -File | ForEach-Object { $rel = $_.FullName.Substring('${escapedTemp}'.Length + 1).Replace('\\', '/'); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null }; $zip.Dispose()"`;
    execSync(psCmd, { stdio: 'inherit' });
  } else {
    execSync(`cd "${tempDir}" && zip -r "${zipOutput}" ./*`, { stdio: 'inherit' });
  }

  // 4. Xóa thư mục tạm
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (cleanErr) {
    // Ignore temp deletion errors
  }

  const stats = fs.statSync(zipOutput);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ ĐÃ TẠO FILE NỘP BÀI THÀNH CÔNG!`);
  console.log(`📁 Đường dẫn: ${zipOutput}`);
  console.log(`📊 Dung lượng file nén: ${sizeMB} MB (Hoàn toàn sạch, không chứa node_modules hay .env)`);
  console.log('====================================================\n');
} catch (err) {
  try {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}
  console.error('Lỗi đóng gói zip:', err);
  process.exit(1);
}
