import express from 'express';
import crypto from 'crypto';
import { query, get, run } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { observability } from '../services/observability.js';

const router = express.Router();

/**
 * POST /api/reports
 * Báo cáo tin tuyển dụng ảo / người dùng vi phạm / việc làm spam
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { targetType, targetId, reason, description } = req.body;

    const validTypes = ['job', 'user', 'gig', 'freelance'];
    if (!targetType || !validTypes.includes(targetType)) {
      return res.status(400).json({ success: false, message: 'Loại đối tượng báo cáo không hợp lệ (job, user, gig, freelance)' });
    }

    if (!targetId || !reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã đối tượng và lý do báo cáo' });
    }

    const reportId = `rep-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    await run(`
      INSERT INTO reports (id, reporter_id, target_type, target_id, reason, description, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `, [
      reportId,
      req.user.id,
      targetType,
      targetId,
      String(reason).trim(),
      description ? String(description).trim() : ''
    ]);

    observability.logAudit({
      action: 'SUBMIT_REPORT',
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: reportId,
      details: { targetType, targetId, reason },
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Cảm ơn bạn đã gửi báo cáo. Ban quản trị sẽ rà soát và xử lý kịp thời!',
      reportId
    });
  } catch (error) {
    console.error('Lỗi gửi báo cáo:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gửi báo cáo' });
  }
});

/**
 * GET /api/reports/my
 * Danh sách báo cáo của người dùng hiện tại
 */
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM reports WHERE reporter_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, count: rows.length, reports: rows });
  } catch (error) {
    console.error('Lỗi lấy báo cáo cá nhân:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * GET /api/reports
 * Danh sách tất cả báo cáo (Chỉ Quản trị viên)
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    let sql = 'SELECT r.*, u.name as reporter_name, u.email as reporter_email FROM reports r LEFT JOIN users u ON r.reporter_id = u.id WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY r.created_at DESC';

    const rows = await query(sql, params);
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const paginated = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      success: true,
      total: rows.length,
      page: pageNum,
      limit: limitNum,
      reports: paginated
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách báo cáo:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * PATCH /api/reports/:id/status
 * Cập nhật trạng thái xử lý báo cáo (Chỉ Quản trị viên)
 */
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ (pending, resolved, dismissed)' });
    }

    const report = await get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo' });
    }

    await run('UPDATE reports SET status = ? WHERE id = ?', [status, req.params.id]);

    observability.logAudit({
      action: 'ADMIN_UPDATE_REPORT_STATUS',
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: req.params.id,
      details: { oldStatus: report.status, newStatus: status },
      ip: req.ip
    });

    res.json({ success: true, message: `Đã cập nhật trạng thái báo cáo thành [${status}]` });
  } catch (error) {
    console.error('Lỗi cập nhật báo cáo:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

export default router;
