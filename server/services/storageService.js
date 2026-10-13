/**
 * WorkLink Storage Service (P1 - Object Storage & Local Disk Adapter)
 * Hỗ trợ lưu trữ CV an toàn với AWS S3 (@aws-sdk/client-s3) hoặc Local Disk Adapter
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { uploadToS3, getPresignedUrl, deleteFromS3, isS3Configured } from '../config/s3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_UPLOAD_DIR = process.env.CV_UPLOAD_DIR || path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

export const storageService = {
  provider: isS3Configured ? 's3' : (process.env.STORAGE_PROVIDER || 'local'),

  /**
   * Lưu file CV vào hệ thống lưu trữ (AWS S3 hoặc Local Disk Adapter)
   */
  async saveFile(buffer, originalName, userId) {
    const ext = path.extname(originalName).toLowerCase() || '.pdf';
    const safeBasename = `cv-${userId || 'anon'}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    const destinationPath = path.join(LOCAL_UPLOAD_DIR, safeBasename);
    const s3Key = `cv/${userId || 'anon'}/${safeBasename}`;

    // Lưu cục bộ an toàn
    await fs.promises.writeFile(destinationPath, buffer);

    // Đồng bộ lên AWS S3 Private Bucket nếu đã cấu hình
    if (isS3Configured) {
      try {
        await uploadToS3({
          buffer,
          key: s3Key,
          contentType: ext === '.pdf' ? 'application/pdf' : 'application/octet-stream',
          metadata: { userId: String(userId || 'anon'), originalName }
        });
      } catch (err) {
        console.warn('[Storage Service S3 Upload Error]:', err.message);
      }
    }

    const presignedUrl = await getPresignedUrl(s3Key, 900);

    return {
      provider: isS3Configured ? 's3' : 'local',
      filename: safeBasename,
      s3Key,
      presignedUrl,
      sizeBytes: buffer.length,
      path: destinationPath
    };
  },

  /**
   * Kiểm tra sự tồn tại của file
   */
  async fileExists(filename) {
    const safeBasename = path.basename(filename);
    const fullPath = path.join(LOCAL_UPLOAD_DIR, safeBasename);
    return fs.existsSync(fullPath);
  },

  /**
   * Lấy đường dẫn file cục bộ hoặc Signed URL
   */
  async getFilePath(filename) {
    const safeBasename = path.basename(filename);
    const fullPath = path.join(LOCAL_UPLOAD_DIR, safeBasename);
    if (!fs.existsSync(fullPath)) return null;
    return fullPath;
  },

  /**
   * Lấy Pre-signed URL có thời hạn cho file
   */
  async getPresignedUrl(keyOrFilename, expiresIn = 900) {
    const key = keyOrFilename.startsWith('cv/') ? keyOrFilename : `cv/shared/${path.basename(keyOrFilename)}`;
    return await getPresignedUrl(key, expiresIn);
  },

  /**
   * Xóa file khỏi hệ thống lưu trữ (Right to be Forgotten - GDPR / Dọn dẹp)
   */
  async deleteFile(filename) {
    try {
      const safeBasename = path.basename(filename);
      const fullPath = path.join(LOCAL_UPLOAD_DIR, safeBasename);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
      if (isS3Configured) {
        await deleteFromS3(`cv/shared/${safeBasename}`);
      }
      return true;
    } catch (err) {
      console.warn('[Storage] Không thể xóa file:', err.message);
    }
    return false;
  }
};

export default storageService;
