import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || null;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || null;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'worklink-uploads-bucket';

/**
 * Kiểm tra cấu hình AWS S3 trong biến môi trường
 */
export const isS3Configured = Boolean(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_S3_BUCKET);

/**
 * Khởi tạo AWS S3 Client
 */
export const s3Client = isS3Configured
  ? new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
      },
      ...(process.env.AWS_S3_ENDPOINT ? { endpoint: process.env.AWS_S3_ENDPOINT, forcePathStyle: true } : {})
    })
  : null;

if (isS3Configured) {
  console.log(`[Storage] ☁️ AWS S3 Client kết nối thành công: Bucket "${AWS_S3_BUCKET}" (${AWS_REGION})`);
} else {
  console.log(`[Storage] 📁 AWS S3 chưa được cấu hình. Hệ thống tự động kích hoạt chế độ lưu trữ cục bộ bền vững.`);
}

/**
 * Tải file (Buffer) lên AWS S3 Private Bucket
 * 
 * @param {Object} params
 * @param {Buffer} params.buffer - Nội dung file dưới dạng Buffer
 * @param {string} params.key - Khóa đường dẫn trong S3 (vd: 'cv/user-123/cv.pdf' hoặc 'avatars/avatar-456.png')
 * @param {string} params.contentType - MIME type của file
 * @param {Object} [params.metadata] - Metadata kèm theo
 * @returns {Promise<{ key: string, bucket: string, url: string }>}
 */
export async function uploadToS3({ buffer, key, contentType = 'application/octet-stream', metadata = {} }) {
  if (isS3Configured && s3Client) {
    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata
    });

    await s3Client.send(command);

    return {
      success: true,
      storage: 's3',
      bucket: AWS_S3_BUCKET,
      key
    };
  }

  // Chế độ dự phòng khi chạy offline hoặc môi trường kiểm thử (Local Fallback)
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  const targetPath = path.join(uploadsDir, key);
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetPath, buffer);

  return {
    success: true,
    storage: 'local',
    bucket: 'local-disk',
    key,
    localPath: targetPath
  };
}

/**
 * Tạo Pre-signed URL có thời hạn để tải / xem file từ Private S3 Bucket
 * Đảm bảo dữ liệu nhạy cảm (CV, Avatar riêng tư) không bị lộ công khai (No Public Bucket)
 * 
 * @param {string} key - S3 Key của file
 * @param {number} [expiresInSeconds=900] - Thời hạn hợp lệ tính bằng giây (mặc định 15 phút)
 * @returns {Promise<string>} Pre-signed URL
 */
export async function getPresignedUrl(key, expiresInSeconds = 900) {
  if (!key) return null;

  if (isS3Configured && s3Client) {
    const command = new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    return signedUrl;
  }

  // Fallback: URL nội bộ an toàn khi chưa cấu hình AWS
  return `/api/storage/file/${encodeURIComponent(key)}?expires=${Date.now() + expiresInSeconds * 1000}`;
}

/**
 * Xóa file trên S3
 * 
 * @param {string} key - S3 Key của file
 */
export async function deleteFromS3(key) {
  if (!key) return;

  if (isS3Configured && s3Client) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key
      });
      await s3Client.send(command);
    } catch (err) {
      console.warn(`[S3 Delete Error] Key: ${key}:`, err.message);
    }
    return;
  }

  // Fallback: Xóa file local nếu tồn tại
  try {
    const targetPath = path.resolve(process.cwd(), 'uploads', key);
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  } catch {}
}

export default {
  s3Client,
  isS3Configured,
  uploadToS3,
  getPresignedUrl,
  deleteFromS3
};
