import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const zipPath = path.join(rootDir, 'WorkLink_Submission.zip');

if (!fs.existsSync(zipPath)) {
  console.error('❌ Không tìm thấy file WorkLink_Submission.zip tại thư mục gốc!');
  process.exit(1);
}

/**
 * Đọc toàn bộ danh sách đường dẫn file bên trong ZIP hoàn toàn bằng Node.js thuần (Buffer)
 * Không phụ thuộc vào PowerShell, unzip, hay bất kỳ phần mềm ngoài nào (chạy 100% trên Windows, Linux, macOS)
 * @param {string} filePath 
 * @returns {string[]}
 */
function getZipEntries(filePath) {
  const buffer = fs.readFileSync(filePath);
  const len = buffer.length;

  // Tìm End of Central Directory Record (EOCD signature: 0x06054b50)
  let eocdOffset = -1;
  const minOffset = Math.max(0, len - 65557);
  for (let i = len - 22; i >= minOffset; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Định dạng file không hợp lệ (không tìm thấy EOCD signature của ZIP)');
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  const entries = [];
  let offset = cdOffset;
  const maxOffset = cdOffset + cdSize;

  for (let i = 0; i < totalEntries && offset < maxOffset; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      break;
    }

    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);

    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
    entries.push(fileName);

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

try {
  const entries = getZipEntries(zipPath);
  const stats = fs.statSync(zipPath);
  const sizeKB = (stats.size / 1024).toFixed(1);

  const backslashes = entries.filter(e => e.includes('\\')).length;
  const nodeModules = entries.filter(e => e.includes('node_modules')).length;
  const envFiles = entries.filter(e => e === '.env' || e.endsWith('/.env')).length;
  const sqliteFiles = entries.filter(e => e.endsWith('.sqlite') || e.includes('.sqlite-')).length;
  const hasSchema = entries.some(e => e === 'database/schema.sql');
  const hasCompose = entries.some(e => e === 'docker-compose.yml');
  const hasShared = entries.filter(e => e.startsWith('shared/')).length;
  const hasServer = entries.filter(e => e.startsWith('server/')).length;
  const hasSrc = entries.filter(e => e.startsWith('src/')).length;
  const testArtifacts = entries.filter(e => e.includes('test-results') || e.includes('playwright-report')).length;
  const backupFiles = entries.filter(e => e.startsWith('backups/') || e.includes('backup_')).length;

  console.log('================================================================');
  console.log('📦 KẾT QUẢ KIỂM TRA FILE NỘP BÀI (WorkLink_Submission.zip)');
  console.log('   (Kiểm tra độc lập bằng Pure Node.js - Chạy được trên mọi HĐH)');
  console.log('================================================================');
  console.log(`Dung lượng file nén : ${sizeKB} KB (~${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`Tổng số file/thư mục: ${entries.length}`);
  console.log('----------------------------------------------------------------');
  console.log(`1.  Đường dẫn chuẩn POSIX (dấu / không dùng \\) : ${backslashes === 0 ? '✅ HỢP LỆ (0 file lỗi)' : `❌ LỖI (${backslashes} file có dấu \\)`}`);
  console.log(`2.  Không chứa thư mục node_modules/         : ${nodeModules === 0 ? '✅ SẠCH (0 file)' : `❌ LỖI (${nodeModules} file)`}`);
  console.log(`3.  Không chứa file bí mật .env               : ${envFiles === 0 ? '✅ SẠCH (0 file)' : `❌ LỖI (${envFiles} file)`}`);
  console.log(`4.  Không chứa file cơ sở dữ liệu tạm thời    : ${sqliteFiles === 0 ? '✅ SẠCH (0 file)' : `❌ LỖI (${sqliteFiles} file)`}`);
  console.log(`5.  Không chứa test-results / artifacts thừa  : ${testArtifacts === 0 ? '✅ SẠCH (0 file)' : `❌ LỖI (${testArtifacts} file)`}`);
  console.log(`6.  Không chứa file bản sao lưu database      : ${backupFiles === 0 ? '✅ SẠCH (0 file)' : `❌ LỖI (${backupFiles} file)`}`);
  console.log(`7.  File database/schema.sql (PostgreSQL)     : ${hasSchema ? '✅ ĐẦY ĐỦ' : '❌ THIẾU'}`);
  console.log(`8.  File docker-compose.yml                   : ${hasCompose ? '✅ ĐẦY ĐỦ' : '❌ THIẾU'}`);
  console.log(`9.  Thư mục shared/ (chia sẻ types & data)    : ${hasShared > 0 ? `✅ ĐẦY ĐỦ (${hasShared} files)` : '❌ THIẾU'}`);
  console.log(`10. Mã nguồn backend server/                  : ${hasServer > 0 ? `✅ ĐẦY ĐỦ (${hasServer} files)` : '❌ THIẾU'}`);
  console.log(`11. Mã nguồn frontend src/                    : ${hasSrc > 0 ? `✅ ĐẦY ĐỦ (${hasSrc} files)` : '❌ THIẾU'}`);
  console.log('================================================================');

  const isClean = backslashes === 0 &&
                  nodeModules === 0 &&
                  envFiles === 0 &&
                  sqliteFiles === 0 &&
                  testArtifacts === 0 &&
                  backupFiles === 0 &&
                  hasSchema &&
                  hasCompose &&
                  hasShared > 0 &&
                  hasServer > 0 &&
                  hasSrc > 0;

  if (isClean) {
    console.log('🎉 XÁC NHẬN: File nén HOÀN TOÀN ĐẠT CHUẨN ĐÓNG GÓI & SẠCH SẼ 100%!');
    console.log('   Sẵn sàng để nộp bài hoặc triển khai với PostgreSQL.');
  } else {
    console.warn('⚠️ Phát hiện vấn đề trong file nén, vui lòng kiểm tra các chỉ số trên.');
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Lỗi khi đọc file nén:', err.message);
  process.exit(1);
}
