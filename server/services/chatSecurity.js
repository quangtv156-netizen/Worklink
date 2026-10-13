import { get, run } from '../db.js';

/**
 * Kiểm tra người dùng có quyền truy cập vào cuộc hội thoại (threadId) hay không
 * @param {string} userId ID người dùng
 * @param {string} userRole Vai trò ('job_seeker' | 'employer' | 'admin')
 * @param {string} threadId ID cuộc hội thoại
 * @returns {Promise<boolean>}
 */
export async function canUserAccessThread(userId, userRole, threadId) {
  if (!userId || !threadId) return false;
  // Quản trị viên luôn có quyền kiểm duyệt / hỗ trợ
  if (userRole === 'admin') return true;

  // 1. Kiểm tra trực tiếp trong bảng chat_threads
  try {
    const thread = await get(
      'SELECT id, seeker_id, employer_id FROM chat_threads WHERE id = ?',
      [threadId]
    );
    if (thread) {
      return thread.seeker_id === userId || thread.employer_id === userId;
    }
  } catch (err) {
    console.warn('[ChatSecurity] Lỗi truy vấn chat_threads:', err.message);
  }

  // 2. Định dạng thread_app_${appId}
  if (threadId.startsWith('thread_app_')) {
    const appId = threadId.replace('thread_app_', '');
    try {
      const appRow = await get(
        `SELECT a.user_id as seeker_id, j.employer_id, a.job_id 
         FROM applications a 
         LEFT JOIN jobs j ON a.job_id = j.id 
         WHERE a.id = ?`,
        [appId]
      );
      if (appRow) {
        if (appRow.seeker_id === userId || appRow.employer_id === userId) {
          // Lưu vào chat_threads để tối ưu các lần truy vấn tiếp theo
          await run(
            `INSERT INTO chat_threads (id, job_id, seeker_id, employer_id) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
            [threadId, appRow.job_id, appRow.seeker_id, appRow.employer_id]
          ).catch(() => {});
          return true;
        }
        return false;
      }
    } catch (err) {
      console.warn('[ChatSecurity] Lỗi kiểm tra app thread:', err.message);
    }
  }

  // 3. Định dạng thread_job_${jobId}_${seekerId}
  const jobMatch = threadId.match(/^thread_job_([^_]+)_(.+)$/);
  if (jobMatch) {
    const [, jobId, rawSeekerId] = jobMatch;
    try {
      const jobRow = await get('SELECT employer_id FROM jobs WHERE id = ?', [jobId]);
      if (jobRow) {
        const isEmployer = jobRow.employer_id === userId;
        const isSeeker = rawSeekerId === userId || rawSeekerId === userId.replace(/[^a-zA-Z0-9_-]/g, '_');
        if (isEmployer || isSeeker) {
          await run(
            `INSERT INTO chat_threads (id, job_id, seeker_id, employer_id) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
            [threadId, jobId, isSeeker ? userId : rawSeekerId, jobRow.employer_id]
          ).catch(() => {});
          return true;
        }
        return false;
      }
    } catch (err) {
      console.warn('[ChatSecurity] Lỗi kiểm tra job thread:', err.message);
    }
  }

  return false;
}

/**
 * Lấy ID người nhận tin nhắn trong cuộc hội thoại (người còn lại khác senderId)
 * @param {string} senderId ID người gửi
 * @param {string} threadId ID cuộc hội thoại
 * @returns {Promise<string|null>} ID người nhận
 */
export async function getThreadRecipient(senderId, threadId) {
  if (!senderId || !threadId) return null;
  try {
    const thread = await get(
      'SELECT seeker_id, employer_id FROM chat_threads WHERE id = ?',
      [threadId]
    );
    if (thread) {
      if (thread.seeker_id === senderId) return thread.employer_id;
      if (thread.employer_id === senderId) return thread.seeker_id;
      return null;
    }

    // Fallback: Phân tích theo cấu trúc thread_app_
    if (threadId.startsWith('thread_app_')) {
      const appId = threadId.replace('thread_app_', '');
      const appRow = await get(
        `SELECT a.user_id as seeker_id, j.employer_id FROM applications a LEFT JOIN jobs j ON a.job_id = j.id WHERE a.id = ?`,
        [appId]
      );
      if (appRow) {
        if (appRow.seeker_id === senderId) return appRow.employer_id;
        if (appRow.employer_id === senderId) return appRow.seeker_id;
      }
    }

    // Fallback: Phân tích theo cấu trúc thread_job_
    const jobMatch = threadId.match(/^thread_job_([^_]+)_(.+)$/);
    if (jobMatch) {
      const [, jobId, rawSeekerId] = jobMatch;
      const jobRow = await get('SELECT employer_id FROM jobs WHERE id = ?', [jobId]);
      if (jobRow) {
        if (jobRow.employer_id === senderId) return rawSeekerId;
        return jobRow.employer_id;
      }
    }
  } catch (err) {
    console.warn('[ChatSecurity] Lỗi getThreadRecipient:', err.message);
  }
  return null;
}
