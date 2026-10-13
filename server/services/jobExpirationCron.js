import cron from 'node-cron';
import { run, query } from '../db.js';
import { invalidateJobsCache } from '../config/redis.js';

/**
 * Quét và tự động chuyển các tin tuyển dụng quá hạn sang trạng thái 'expired'
 * Tiêu chí quá hạn:
 * 1. expires_at < CURRENT_TIMESTAMP HOẶC
 * 2. deadline < CURRENT_DATE (với các tin có trường deadline text định dạng YYYY-MM-DD)
 * Chỉ áp dụng cho các tin tuyển dụng đang ở trạng thái 'active' hoặc 'pending'
 * 
 * @returns {Promise<{ updatedCount: number, expiredJobIds: string[] }>}
 */
export async function autoExpireOutdatedJobs() {
  try {
    // 1. Tìm các tin tuyển dụng thỏa mãn điều kiện quá hạn
    const outdatedJobs = await query(`
      SELECT id, title, company, status, expires_at, deadline 
      FROM jobs 
      WHERE status IN ('active', 'pending')
        AND (
          (expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP)
          OR (deadline IS NOT NULL AND deadline <> '' AND deadline < CURRENT_DATE::text)
        )
    `);

    if (!outdatedJobs || outdatedJobs.length === 0) {
      return { updatedCount: 0, expiredJobIds: [] };
    }

    const expiredJobIds = outdatedJobs.map(j => j.id);

    // 2. Cập nhật trạng thái thành 'expired'
    const result = await run(`
      UPDATE jobs 
      SET status = 'expired'
      WHERE status IN ('active', 'pending')
        AND (
          (expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP)
          OR (deadline IS NOT NULL AND deadline <> '' AND deadline < CURRENT_DATE::text)
        )
    `);

    // 3. Làm mới Cache Redis để API phản ánh dữ liệu mới nhất
    await invalidateJobsCache();

    console.log(`[Job Cron] ⏰ Đã tự động chuyển ${result.changes || expiredJobIds.length} tin tuyển dụng quá hạn sang trạng thái 'expired'`);
    return {
      updatedCount: result.changes || expiredJobIds.length,
      expiredJobIds
    };
  } catch (error) {
    console.error('[Job Cron Error] Lỗi khi quét tin tuyển dụng quá hạn:', error.message);
    return { updatedCount: 0, expiredJobIds: [], error: error.message };
  }
}

/**
 * Khởi động Cron Job tự động chạy mỗi ngày lúc 0:00 (Nửa đêm)
 * Timezone: Asia/Ho_Chi_Minh
 */
export function startJobExpirationCron() {
  // Biểu thức Cron: '0 0 * * *' -> Phút 0, Giờ 0 mỗi ngày
  const task = cron.schedule('0 0 * * *', async () => {
    console.log('[Job Cron] 🕛 Bắt đầu tiến trình kiểm tra & tự động ẩn tin tuyển dụng quá hạn lúc 0:00...');
    await autoExpireOutdatedJobs();
  }, {
    scheduled: true,
    timezone: 'Asia/Ho_Chi_Minh'
  });

  console.log('[Job Cron] 🕒 Đã kích hoạt Cron Job tự động ẩn tin quá hạn (Lịch chạy: 0:00 hàng ngày, Asia/Ho_Chi_Minh)');
  return task;
}

export default {
  autoExpireOutdatedJobs,
  startJobExpirationCron
};
