import cron from 'node-cron';
import { run } from '../db.js';
import { acquireDistributedLock, releaseDistributedLock } from '../config/redis.js';

/**
 * ============================================================
 * AI QUOTA RESET CRON SERVICE (WorkLink PDPA & Quota Management)
 * ============================================================
 * Tự động làm mới (reset) hạn mức quét CV bằng Gemini AI về 5 lượt
 * cho tất cả người dùng hợp lệ vào lúc 0:00 ngày mùng 1 hàng tháng.
 *
 * Tích hợp Distributed Lock (Redis) chống chạy trùng lặp khi chạy đa node/server.
 */

/**
 * Thực thi lệnh reset AI quota về 5 cho toàn bộ tài khoản chưa bị xóa mềm
 * @param {Object} [options]
 * @param {boolean} [options.useLock=false] - Có sử dụng Distributed Lock hay không
 * @returns {Promise<{ success: boolean, updatedCount: number, timestamp: string, locked?: boolean, message?: string }>}
 */
export async function resetMonthlyAiQuota({ useLock = false } = {}) {
  const currentMonthKey = `lock:ai_quota_reset:${new Date().toISOString().slice(0, 7)}`;
  let lockAcquired = false;

  if (useLock) {
    lockAcquired = await acquireDistributedLock(currentMonthKey, 3600); // Khóa 1 giờ
    if (!lockAcquired) {
      console.log(`[AI Quota Cron] 🔒 Bỏ qua thực thi: Tiến trình reset AI Quota tháng này đã được thực hiện bởi instance khác (Lock key: ${currentMonthKey}).`);
      return {
        success: true,
        updatedCount: 0,
        locked: true,
        message: 'Bỏ qua do tiến trình khác đang xử lý (Distributed Lock active)',
        timestamp: new Date().toISOString()
      };
    }
  }

  try {
    const result = await run(`
      UPDATE users 
      SET ai_quota = 5,
          ai_quota_used = 0
      WHERE deleted_at IS NULL
    `);

    const updatedCount = result.changes || 0;
    console.log(`[AI Quota Cron] 🔄 Đã tự động reset AI Quota về 5 cho ${updatedCount} tài khoản người dùng.`);
    
    return {
      success: true,
      updatedCount,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[AI Quota Cron Error] Lỗi khi thực hiện reset hạn mức AI:', error.message);
    if (useLock && lockAcquired) {
      await releaseDistributedLock(currentMonthKey).catch(() => {});
    }
    return {
      success: false,
      updatedCount: 0,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Khởi động Cron Job tự động chạy lúc 0:00 ngày mùng 1 hàng tháng
 * Cron expression: '0 0 1 * *' (Phút 0, Giờ 0, Ngày 1, Mọi tháng, Mọi thứ)
 * Múi giờ: Asia/Ho_Chi_Minh
 * Tích hợp Distributed Lock (Redis) để ngăn chặn chạy lặp khi deploy multi-instance.
 */
export function startAiQuotaCron() {
  const task = cron.schedule('0 0 1 * *', async () => {
    console.log('[AI Quota Cron] 📅 Bắt đầu tiến trình định kỳ: Reset AI Quota về 5 vào ngày 1 hàng tháng...');
    await resetMonthlyAiQuota({ useLock: true });
  }, {
    scheduled: true,
    timezone: 'Asia/Ho_Chi_Minh'
  });

  console.log('[AI Quota Cron] 🕒 Đã kích hoạt Cron Job tự động reset AI Quota về 5 kèm Redis Distributed Lock (0:00 ngày mùng 1 hàng tháng, Asia/Ho_Chi_Minh)');
  return task;
}

export default {
  resetMonthlyAiQuota,
  startAiQuotaCron
};
