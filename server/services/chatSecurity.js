import { get, run } from "../db.js";

/**
 * Lưu thread vào chat_threads (chỉ khi đủ cả 2 phía) để các lần sau tra nhanh.
 */
async function persistThread(threadId, jobId, seekerId, employerId) {
  if (!seekerId || !employerId) return;
  await run(
    `INSERT INTO chat_threads (id, job_id, seeker_id, employer_id) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    [threadId, jobId || null, seekerId, employerId],
  ).catch(() => {});
}

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
  if (userRole === "admin") return true;

  // 1. Kiểm tra trực tiếp trong bảng chat_threads
  try {
    const thread = await get(
      "SELECT id, seeker_id, employer_id FROM chat_threads WHERE id = ?",
      [threadId],
    );
    if (thread) {
      return thread.seeker_id === userId || thread.employer_id === userId;
    }
  } catch (err) {
    console.warn("[ChatSecurity] Lỗi truy vấn chat_threads:", err.message);
  }

  // 2. Định dạng thread_app_${appId}
  if (threadId.startsWith("thread_app_")) {
    const appId = threadId.replace("thread_app_", "");
    try {
      const appRow = await get(
        `SELECT a.user_id as seeker_id, j.employer_id, a.job_id 
         FROM applications a 
         LEFT JOIN jobs j ON a.job_id = j.id 
         WHERE a.id = ?`,
        [appId],
      );
      if (appRow) {
        if (appRow.seeker_id === userId || appRow.employer_id === userId) {
          await persistThread(
            threadId,
            appRow.job_id,
            appRow.seeker_id,
            appRow.employer_id,
          );
          return true;
        }
        return false;
      }
    } catch (err) {
      console.warn("[ChatSecurity] Lỗi kiểm tra app thread:", err.message);
    }
  }

  // 3. Định dạng thread_prop_${proposalId} (đề xuất Freelance: freelancer <-> chủ dự án)
  if (threadId.startsWith("thread_prop_")) {
    const propId = threadId.replace("thread_prop_", "");
    try {
      const row = await get(
        `SELECT p.user_id AS seeker_id, pr.employer_id
         FROM freelance_proposals p
         JOIN freelance_projects pr ON p.project_id = pr.id
         WHERE p.id = ?`,
        [propId],
      );
      if (row) {
        if (row.seeker_id === userId || row.employer_id === userId) {
          await persistThread(threadId, null, row.seeker_id, row.employer_id);
          return true;
        }
        return false;
      }
    } catch (err) {
      console.warn("[ChatSecurity] Lỗi kiểm tra proposal thread:", err.message);
    }
  }

  // 4. Định dạng thread_gig_${gigId} (việc vặt: người nhận việc <-> người đăng)
  if (threadId.startsWith("thread_gig_")) {
    const gigId = threadId.replace("thread_gig_", "");
    try {
      const row = await get(
        "SELECT employer_id, accepted_by AS seeker_id FROM gig_tasks WHERE id = ?",
        [gigId],
      );
      if (row) {
        if (row.seeker_id === userId || row.employer_id === userId) {
          await persistThread(threadId, null, row.seeker_id, row.employer_id);
          return true;
        }
        return false;
      }
    } catch (err) {
      console.warn("[ChatSecurity] Lỗi kiểm tra gig thread:", err.message);
    }
  }

  // 5. Định dạng thread_job_${jobId}_${seekerId}
  const jobMatch = threadId.match(/^thread_job_([^_]+)_(.+)$/);
  if (jobMatch) {
    const [, jobId, rawSeekerId] = jobMatch;
    try {
      const jobRow = await get("SELECT employer_id FROM jobs WHERE id = ?", [
        jobId,
      ]);
      if (jobRow) {
        const isEmployer = jobRow.employer_id === userId;
        const isSeeker =
          rawSeekerId === userId ||
          rawSeekerId === userId.replace(/[^a-zA-Z0-9_-]/g, "_");
        if (isEmployer || isSeeker) {
          await persistThread(
            threadId,
            jobId,
            isSeeker ? userId : rawSeekerId,
            jobRow.employer_id,
          );
          return true;
        }
        return false;
      }
    } catch (err) {
      console.warn("[ChatSecurity] Lỗi kiểm tra job thread:", err.message);
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
      "SELECT seeker_id, employer_id FROM chat_threads WHERE id = ?",
      [threadId],
    );
    if (thread) {
      if (thread.seeker_id === senderId) return thread.employer_id;
      if (thread.employer_id === senderId) return thread.seeker_id;
      return null;
    }

    // Fallback: Phân tích theo cấu trúc thread_app_
    if (threadId.startsWith("thread_app_")) {
      const appId = threadId.replace("thread_app_", "");
      const appRow = await get(
        `SELECT a.user_id as seeker_id, j.employer_id FROM applications a LEFT JOIN jobs j ON a.job_id = j.id WHERE a.id = ?`,
        [appId],
      );
      if (appRow) {
        if (appRow.seeker_id === senderId) return appRow.employer_id;
        if (appRow.employer_id === senderId) return appRow.seeker_id;
      }
    }

    // Fallback: thread_prop_ (đề xuất Freelance)
    if (threadId.startsWith("thread_prop_")) {
      const propId = threadId.replace("thread_prop_", "");
      const row = await get(
        `SELECT p.user_id AS seeker_id, pr.employer_id
         FROM freelance_proposals p
         JOIN freelance_projects pr ON p.project_id = pr.id
         WHERE p.id = ?`,
        [propId],
      );
      if (row) {
        if (row.seeker_id === senderId) return row.employer_id;
        if (row.employer_id === senderId) return row.seeker_id;
      }
    }

    // Fallback: thread_gig_ (việc vặt)
    if (threadId.startsWith("thread_gig_")) {
      const gigId = threadId.replace("thread_gig_", "");
      const row = await get(
        "SELECT employer_id, accepted_by AS seeker_id FROM gig_tasks WHERE id = ?",
        [gigId],
      );
      if (row) {
        if (row.seeker_id === senderId) return row.employer_id;
        if (row.employer_id === senderId) return row.seeker_id;
      }
    }

    // Fallback: Phân tích theo cấu trúc thread_job_
    const jobMatch = threadId.match(/^thread_job_([^_]+)_(.+)$/);
    if (jobMatch) {
      const [, jobId, rawSeekerId] = jobMatch;
      const jobRow = await get("SELECT employer_id FROM jobs WHERE id = ?", [
        jobId,
      ]);
      if (jobRow) {
        if (jobRow.employer_id === senderId) return rawSeekerId;
        return jobRow.employer_id;
      }
    }
  } catch (err) {
    console.warn("[ChatSecurity] Lỗi getThreadRecipient:", err.message);
  }
  return null;
}
