import express from 'express';
import { query, get, run } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { observability } from '../services/observability.js';
import { recordAuditLog } from '../services/auditLogger.js';
import { invalidateJobsCache } from '../config/redis.js';

const router = express.Router();

// TẤT CẢ các endpoint trong router này bắt buộc phải là Admin
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/stats
 * Thống kê toàn diện hệ thống WorkLink từ cơ sở dữ liệu
 */
router.get('/stats', async (req, res) => {
  try {
    // 1. Thống kê người dùng theo vai trò
    const userRoleCounts = await query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `);
    const usersByRole = userRoleCounts.reduce((acc, row) => {
      acc[row.role] = row.count;
      return acc;
    }, { job_seeker: 0, employer: 0, admin: 0 });

    const totalUsers = Object.values(usersByRole).reduce((a, b) => a + b, 0);

    // 2. Thống kê việc làm
    const jobsCountRow = await get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_hot = 1 THEN 1 ELSE 0 END) as hot_count,
        SUM(CASE WHEN is_pinned = 1 THEN 1 ELSE 0 END) as pinned_count,
        SUM(views) as total_views,
        SUM(likes) as total_likes
      FROM jobs
    `);

    // Danh mục việc làm
    const categoryStats = await query(`
      SELECT category, COUNT(*) as count 
      FROM jobs 
      GROUP BY category 
      ORDER BY count DESC 
      LIMIT 8
    `);

    // 3. Thống kê ứng tuyển
    const appStats = await query(`
      SELECT status, COUNT(*) as count 
      FROM applications 
      GROUP BY status
    `);
    const applicationsByStatus = appStats.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, { pending: 0, reviewed: 0, interview: 0, rejected: 0 });

    const totalApplications = Object.values(applicationsByStatus).reduce((a, b) => a + b, 0);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          seekers: usersByRole.job_seeker || 0,
          employers: usersByRole.employer || 0,
          admins: usersByRole.admin || 0
        },
        jobs: {
          total: jobsCountRow?.total || 0,
          hot: jobsCountRow?.hot_count || 0,
          pinned: jobsCountRow?.pinned_count || 0,
          totalViews: jobsCountRow?.total_views || 0,
          totalLikes: jobsCountRow?.total_likes || 0,
          categories: categoryStats
        },
        applications: {
          total: totalApplications,
          byStatus: applicationsByStatus
        },
        serverTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Lỗi lấy thống kê admin:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải thống kê hệ thống' });
  }
});

/**
 * GET /api/admin/metrics
 * Chỉ số vận hành sản phẩm nâng cao (DAU, tỉ lệ ứng tuyển, chuyển đổi phỏng vấn, báo cáo)
 */
router.get('/metrics', async (req, res) => {
  try {
    // 1. Hoạt động người dùng hôm nay (DAU ước lượng từ hành vi ứng tuyển, chào thầu, chat)
    const activeTodayRow = await get(`
      SELECT COUNT(DISTINCT user_id) as dau
      FROM (
        SELECT user_id FROM applications WHERE created_at >= CURRENT_DATE
        UNION
        SELECT user_id FROM freelance_proposals WHERE created_at >= CURRENT_DATE
        UNION
        SELECT sender_id as user_id FROM chat_messages WHERE created_at >= CURRENT_DATE
      ) active_users
    `).catch(() => ({ dau: 0 }));

    // 2. Tỉ lệ ứng tuyển & phỏng vấn (Conversion)
    const appStats = await get(`
      SELECT 
        COUNT(*) as total_apps,
        SUM(CASE WHEN status = 'interview' THEN 1 ELSE 0 END) as interview_apps,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_apps
      FROM applications
    `).catch(() => ({ total_apps: 0, interview_apps: 0 }));

    const totalApps = appStats?.total_apps || 0;
    const interviewApps = appStats?.interview_apps || 0;
    const conversionRate = totalApps > 0 ? ((interviewApps / totalApps) * 100).toFixed(1) : '0.0';

    // 3. Số lượng tin tuyển dụng đang hoạt động
    const activeJobsRow = await get(`
      SELECT COUNT(*) as active_jobs 
      FROM jobs 
      WHERE (deadline IS NULL OR deadline = '' OR deadline >= CURRENT_DATE::text)
    `).catch(() => ({ active_jobs: 0 }));

    // 4. Báo cáo vi phạm chờ xử lý
    const pendingReportsRow = await get(`
      SELECT COUNT(*) as pending_reports FROM reports WHERE status = 'pending'
    `).catch(() => ({ pending_reports: 0 }));

    res.json({
      success: true,
      metrics: {
        dau: activeTodayRow?.dau || 0,
        totalApplications: totalApps,
        interviewCount: interviewApps,
        conversionRatePercent: parseFloat(conversionRate),
        activeJobs: activeJobsRow?.active_jobs || 0,
        pendingReports: pendingReportsRow?.pending_reports || 0,
        serverUptimeHours: (process.uptime() / 3600).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Lỗi metrics:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải metrics' });
  }
});

/**
 * GET /api/admin/users
 * Danh sách người dùng hệ thống (chỉ admin mới có quyền truy cập)
 * Bắt buộc phân trang: Mặc định limit 20, max 50. Trả về metadata đầy đủ.
 */
router.get('/users', async (req, res) => {
  try {
    const { page, limit, role, search } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereSql = ' WHERE deleted_at IS NULL';
    const params = [];

    if (role && role !== 'ALL') {
      whereSql += ' AND role = ?';
      params.push(role);
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      whereSql += ' AND (name ILIKE ? OR email ILIKE ? OR phone ILIKE ?)';
      params.push(s, s, s);
    }

    // 1. Đếm tổng số bản ghi người dùng phù hợp bộ lọc
    const countRow = await get(`SELECT COUNT(*) as total FROM users${whereSql}`, params);
    const total = parseInt(countRow?.total, 10) || 0;
    const totalPages = Math.ceil(total / limitNum) || 1;

    // 2. Lấy danh sách người dùng phân trang ở tầng SQL
    const listSql = `
      SELECT id, name, email, role, phone, district, city, title, is_verified, created_at 
      FROM users 
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(listSql, [...params, limitNum, offset]);

    const pagination = {
      total,
      currentPage: pageNum,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    };

    res.json({
      success: true,
      count: rows.length,
      total,
      currentPage: pageNum,
      totalPages,
      limit: limitNum,
      pagination,
      users: rows
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách user:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

const handleUpdateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['job_seeker', 'employer', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
    }

    const targetUserId = req.params.id;
    const currentAdminId = req.user.id;

    // 1. Kiểm tra tài khoản mục tiêu có tồn tại không
    const targetUser = await get('SELECT id, role, name, email FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // 2. Chặn admin tự hạ quyền của chính mình
    if (targetUserId === currentAdminId && role !== 'admin') {
      return res.status(400).json({ 
        success: false, 
        message: 'Bạn không thể tự hạ quyền Quản trị viên của chính mình!' 
      });
    }

    // 3. Chặn hạ quyền Quản trị viên cuối cùng của hệ thống
    if (targetUser.role === 'admin' && role !== 'admin') {
      const adminCountRow = await get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
      if ((adminCountRow?.count || 0) <= 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Không thể hạ quyền Quản trị viên cuối cùng của hệ thống!' 
        });
      }
    }

    await run('UPDATE users SET role = ? WHERE id = ?', [role, targetUserId]);

    observability.logAudit({
      action: 'ADMIN_UPDATE_USER_ROLE',
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: targetUserId,
      details: { oldRole: targetUser.role, newRole: role },
      ip: req.ip
    });

    res.json({ success: true, message: `Đã cập nhật vai trò người dùng thành [${role}]` });
  } catch (error) {
    console.error('Lỗi phân quyền user:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật' });
  }
};

/**
 * PATCH & PUT /api/admin/users/:id/role
 * Thay đổi vai trò người dùng (Chỉ Quản trị viên tối cao)
 */
router.patch('/users/:id/role', handleUpdateUserRole);
router.put('/users/:id/role', handleUpdateUserRole);

/**
 * DELETE /api/admin/users/:id
 * Xoá người dùng hệ thống (Chỉ Admin)
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (targetUserId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Bạn không thể tự xoá chính mình!' });
    }

    const targetUser = await get('SELECT id, role, email FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    if (targetUser.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Không thể xoá tài khoản Quản trị viên!' });
    }

    // Xoá các dữ liệu liên quan
    await run('DELETE FROM applications WHERE user_id = ?', [targetUserId]).catch(() => {});
    await run('DELETE FROM freelance_proposals WHERE user_id = ?', [targetUserId]).catch(() => {});
    await run('DELETE FROM notifications WHERE user_id = ?', [targetUserId]).catch(() => {});
    await run('DELETE FROM users WHERE id = ?', [targetUserId]);

    observability.logAudit({
      action: 'ADMIN_DELETE_USER',
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: targetUserId,
      details: { email: targetUser.email, role: targetUser.role },
      ip: req.ip
    });

    res.json({ success: true, message: `Đã xoá người dùng ${targetUser.email} thành công` });
  } catch (error) {
    console.error('Lỗi xoá user:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xoá người dùng' });
  }
});

/**
 * PUT /api/admin/jobs/:id/status
 * Cụm 11: Kiểm duyệt tin tuyển dụng (Job Moderation) bởi Quản trị viên
 * Bắt buộc qua authenticateToken và requireAdmin
 * Whitelist trạng thái hợp lệ và kiểm tra State Transition:
 * - pending -> active, rejected
 * - active -> rejected, expired, pending
 * - rejected -> active, pending
 * - expired -> active, rejected
 * Khi duyệt hoặc từ chối thành công:
 * 1. Lưu vết vào CSDL bảng audit_logs qua recordAuditLog
 * 2. Xóa Cache Redis (DEL jobs:*) qua invalidateJobsCache
 */
router.put('/jobs/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const jobId = req.params.id;
    const { status, reason } = req.body;

    const validStatuses = ['pending', 'active', 'rejected', 'expired'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Chỉ chấp nhận các trạng thái: ${validStatuses.join(', ')}`
      });
    }

    const job = await get('SELECT id, title, company, status, moderation_status FROM jobs WHERE id = ?', [jobId]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin tuyển dụng' });
    }

    const currentStatus = job.status || (job.moderation_status === 'approved' ? 'active' : 'pending');

    // Bảng chuyển đổi trạng thái hợp lệ (State Transition Matrix)
    const allowedTransitions = {
      pending: ['active', 'rejected'],
      active: ['rejected', 'expired', 'pending'],
      rejected: ['active', 'pending'],
      expired: ['active', 'rejected']
    };

    if (currentStatus !== status && (!allowedTransitions[currentStatus] || !allowedTransitions[currentStatus].includes(status))) {
      return res.status(400).json({
        success: false,
        message: `Chuyển đổi trạng thái không hợp lệ: Không thể chuyển từ [${currentStatus}] sang [${status}].`
      });
    }

    // Đồng bộ moderation_status theo status
    let moderationStatus = job.moderation_status || 'pending';
    if (status === 'active') moderationStatus = 'approved';
    else if (status === 'rejected') moderationStatus = 'rejected';
    else if (status === 'pending') moderationStatus = 'pending';

    // 1. Cập nhật trạng thái CSDL
    await run(
      'UPDATE jobs SET status = ?, moderation_status = ? WHERE id = ?',
      [status, moderationStatus, jobId]
    );

    // 2. Ghi Audit Log vào CSDL bảng audit_logs
    await recordAuditLog({
      adminId: req.user.id,
      action: 'ADMIN_JOB_MODERATION',
      targetId: jobId,
      details: {
        jobTitle: job.title,
        company: job.company,
        previousStatus: currentStatus,
        newStatus: status,
        moderationStatus,
        reason: reason || null
      },
      req
    });

    // 3. Xóa Cache Redis (DEL jobs:*) để cập nhật lại danh sách public
    await invalidateJobsCache();

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái tin tuyển dụng thành [${status}] thành công`,
      job: {
        id: jobId,
        status,
        moderationStatus,
        previousStatus: currentStatus
      }
    });
  } catch (error) {
    console.error('Lỗi kiểm duyệt tin admin:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật trạng thái tin' });
  }
});

/**
 * GET /api/admin/audit-logs
 * Xem lịch sử kiểm toán của Quản trị viên từ CSDL bảng audit_logs
 */
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (pageNum - 1) * limitNum;

    const countRow = await get('SELECT COUNT(*) as total FROM audit_logs').catch(() => ({ total: 0 }));
    const total = parseInt(countRow?.total, 10) || 0;

    const rows = await query(`
      SELECT a.*, u.name as admin_name, u.email as admin_email
      FROM audit_logs a
      LEFT JOIN users u ON a.admin_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [limitNum, offset]).catch(() => []);

    res.json({
      success: true,
      count: rows.length,
      total,
      page: pageNum,
      limit: limitNum,
      auditLogs: rows
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách audit logs:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải audit logs' });
  }
});

export default router;

