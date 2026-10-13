import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query, get, run } from '../db.js';
import { authenticateToken, requireEmployerOrAdmin } from '../middleware/auth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { createNotification } from './notificationRoutes.js';
import { observability } from '../services/observability.js';
import { getPresignedUrl } from '../config/s3.js';

const router = express.Router();
const CV_UPLOAD_DIR = process.env.CV_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'cv');
if (!fs.existsSync(CV_UPLOAD_DIR)) fs.mkdirSync(CV_UPLOAD_DIR, { recursive: true });

/**
 * POST /api/applications
 * Nộp hồ sơ ứng tuyển (BẮt buộc đăng nhập & đã xác thực email)
 */
router.post('/', authenticateToken, requireVerified, async (req, res) => {
  try {
    const { jobId, applicantName, phone, email, note, cvName, cvFileId, fileId } = req.body;

    if (!jobId || !applicantName || !phone) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin ứng tuyển' });
    }

    // ⚠ï¸ Bảo mật: employer và admin không được nộp đơn
    if (req.user.role === 'employer' || req.user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Tài khoản nhà tuyển dụng/quản trị không thể ứng tuyển việc làm' });
    }

    // 🔒 M2: Yêu cầu xác thực email trước khi nộp hồ sơ nếu kích hoạt
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && req.user.is_verified === 0) {
      return res.status(403).json({ success: false, message: 'Vui lòng xác thực email của bạn trước khi nộp hồ sơ ứng tuyển.' });
    }

    const userId = req.user.id;

    // Kiểm tra job tồn tại
    const job = await get('SELECT id, employer_id, title FROM jobs WHERE id = ?', [jobId]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc làm ứng tuyển' });
    }

    // ⚠ï¸ Chặn nộp đơn trùng lặp
    const existing = await get(
      'SELECT id FROM applications WHERE job_id = ? AND user_id = ?',
      [jobId, userId]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'Bạn đã nộp hồ sơ cho vị trí này rồi!' });
    }

    const appId = `app-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    let sanitizedCvPath = null;
    const rawFileId = cvFileId || fileId;
    if (rawFileId && typeof rawFileId === 'string') {
      const safeBasename = path.basename(rawFileId);
      const fullPath = path.join(CV_UPLOAD_DIR, safeBasename);
      if (fs.existsSync(fullPath)) {
        sanitizedCvPath = safeBasename;
      }
    }

    await run(`
      INSERT INTO applications (id, job_id, user_id, applicant_name, phone, email, note, cv_name, cv_file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      appId,
      jobId,
      userId,
      applicantName,
      phone,
      email || '',
      note || '',
      cvName || 'CV_DinhKem.pdf',
      sanitizedCvPath
    ]);

    const created = await get(`
      SELECT a.*, j.title as job_title, j.company 
      FROM applications a 
      JOIN jobs j ON a.job_id = j.id 
      WHERE a.id = ?
    `, [appId]);

    // Notify employer (best-effort)
    try {
      if (job?.employer_id) {
        await createNotification({
          userId: job.employer_id,
          type: 'new_application',
          title: `Hồ sơ mới: ${applicantName}`,
          body: `Vừa nộp đơn vào tin "${created.job_title}"`,
          linkType: 'application',
          linkId: appId
        });
      }
    } catch (notifErr) {
      console.warn('[Notification Warning]:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Nộp hồ sơ ứng tuyển thành công!',
      application: {
        id: created.id,
        jobId: created.job_id,
        jobTitle: created.job_title,
        company: created.company,
        applicantName: created.applicant_name,
        phone: created.phone,
        email: created.email,
        note: created.note,
        cvName: created.cv_name,
        cvFilePath: created.cv_file_path,
        hasCv: Boolean(created.cv_file_path),
        status: created.status,
        appliedAt: created.created_at
      }
    });

  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Bạn đã nộp hồ sơ cho vị trí này rồi!' });
    }
    console.error('Lỗi nộp đơn:', error);
    res.status(500).json({ success: false, message: 'Lỗi nộp hồ sơ' });
  }
});


/**
 * GET /api/applications/my
 * Danh sách ứng tuyển của ứng viên (BẮT BUỘC đăng nhập - bảo mật)
 */
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const rows = await query(
      `SELECT a.*, j.title as job_title, j.company, j.salary_display, j.district
       FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.user_id = ? AND a.deleted_at IS NULL
       ORDER BY a.created_at DESC`,
      [userId]
    );

    const formatted = rows.map(r => ({
      id: r.id,
      jobId: r.job_id,
      jobTitle: r.job_title || 'Vị trí công việc',
      company: r.company || 'Doanh nghiệp',
      applicantName: r.applicant_name,
      phone: r.phone,
      email: r.email,
      note: r.note,
      cvName: r.cv_name,
      cvFilePath: r.cv_file_path,
      hasCv: Boolean(r.cv_file_path),
      status: r.status,
      appliedAt: r.created_at
    }));

    res.json({ success: true, count: formatted.length, applications: formatted });
  } catch (error) {
    console.error('Lỗi lấy danh sách nộp đơn:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});


/**
 * GET /api/applications/employer
 * Nhà tuyển dụng xem danh sách ứng viên nộp vào tin của CHÍNH MÌNH (Admin xem toàn bộ)
 */
router.get('/employer', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const isMasterAdmin = req.user.role === 'admin';
    const employerId = req.user.id;

    const sql = isMasterAdmin
      ? `SELECT a.*, j.title as job_title, j.company, j.salary_display, j.district, j.employer_id
         FROM applications a
         LEFT JOIN jobs j ON a.job_id = j.id
         WHERE a.deleted_at IS NULL
         ORDER BY a.created_at DESC`
      : `SELECT a.*, j.title as job_title, j.company, j.salary_display, j.district, j.employer_id
         FROM applications a
         JOIN jobs j ON a.job_id = j.id
         WHERE j.employer_id = ? AND a.deleted_at IS NULL
         ORDER BY a.created_at DESC`;

    const rows = await query(sql, isMasterAdmin ? [] : [employerId]);

    const formatted = rows.map(r => ({
      id: r.id,
      jobId: r.job_id,
      jobTitle: r.job_title || 'Vị trí công việc',
      company: r.company || 'Doanh nghiệp',
      applicantName: r.applicant_name,
      phone: r.phone,
      email: r.email,
      note: r.note,
      cvName: r.cv_name,
      cvFilePath: r.cv_file_path,
      hasCv: Boolean(r.cv_file_path),
      status: r.status,
      appliedAt: r.created_at
    }));

    res.json({ success: true, count: formatted.length, applications: formatted });
  } catch (error) {
    console.error('Lỗi lấy danh sách hồ sơ NTD:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * GET /api/applications/job/:jobId
 * Nhà tuyển dụng xem ứng viên nộp vào một tin cụ thể (có kiểm tra quyền sở hữu)
 */
router.get('/job/:jobId', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const job = await get('SELECT employer_id FROM jobs WHERE id = ?', [req.params.jobId]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc làm' });
    }

    if (req.user.role !== 'admin' && job.employer_id !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Từ chối quyền: Bạn không thể xem hồ sơ ứng tuyển của nhà tuyển dụng khác!' 
      });
    }

    const rows = await query(`
      SELECT a.*, j.title as job_title, j.company
      FROM applications a
      LEFT JOIN jobs j ON a.job_id = j.id
      WHERE a.job_id = ? AND a.deleted_at IS NULL
      ORDER BY a.created_at DESC
    `, [req.params.jobId]);

    const formatted = rows.map(r => ({
      id: r.id,
      jobId: r.job_id,
      jobTitle: r.job_title,
      company: r.company,
      applicantName: r.applicant_name,
      phone: r.phone,
      email: r.email,
      note: r.note,
      cvName: r.cv_name,
      cvFilePath: r.cv_file_path,
      hasCv: Boolean(r.cv_file_path),
      status: r.status,
      appliedAt: r.created_at
    }));

    res.json({ success: true, count: formatted.length, applications: formatted });
  } catch (error) {
    console.error('Lỗi lấy ứng viên theo job:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * PATCH /api/applications/:id/status
 * Cập nhật trạng thái ứng viên (NTD sở hữu tin tuyển dụng hoặc Admin mới được phép)
 */
router.patch('/:id/status', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'reviewed', 'interview', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    // Ownership check
    const appRow = await get(`
      SELECT a.*, j.employer_id, j.title as job_title 
      FROM applications a 
      JOIN jobs j ON a.job_id = j.id 
      WHERE a.id = ?
    `, [req.params.id]);

    if (!appRow) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ ứng tuyển' });
    }

    if (req.user.role !== 'admin' && appRow.employer_id !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Từ chối quyền (403 Forbidden): Bạn không thể xử lý hồ sơ của nhà tuyển dụng khác!' 
      });
    }

    await run('UPDATE applications SET status = ? WHERE id = ?', [status, req.params.id]);

    // Send notification to applicant if user_id exists
    if (appRow.user_id) {
      try {
        const statusLabels = {
          reviewed: 'Đã xem hồ sơ',
          interview: 'Mời phỏng vấn 🎉',
          rejected: 'Từ chối hồ sơ'
        };
        await createNotification({
          userId: appRow.user_id,
          type: 'status_change',
          title: `Cập nhật hồ sơ: ${appRow.job_title}`,
          body: `Nhà tuyển dụng đã cập nhật trạng thái hồ sơ của bạn thành: ${statusLabels[status] || status}`,
          linkType: 'application',
          linkId: appRow.id
        });
      } catch (notifErr) {
        console.warn('[Notification Error]:', notifErr.message);
      }
    }

    res.json({ success: true, message: 'Đã cập nhật trạng thái ứng viên thành công!' });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật' });
  }
});

/**
 * DELETE /api/applications/:id
 * Hủy / Rút hồ sơ ứng tuyển (Chỉ Ứng viên đã nộp đơn hoặc Quản trị viên mới được phép)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const appRow = await get(`
      SELECT a.*, j.title as job_title, j.employer_id 
      FROM applications a 
      LEFT JOIN jobs j ON a.job_id = j.id 
      WHERE a.id = ?
    `, [req.params.id]);

    if (!appRow) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ ứng tuyển' });
    }

    // Ownership check: chỉ chính ứng viên nộp hồ sơ hoặc admin mới được hủy
    if (req.user.role !== 'admin' && appRow.user_id !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Từ chối quyền (403 Forbidden): Bạn không thể hủy hồ sơ của ứng viên khác!' 
      });
    }

    // Xóa đánh giá liên quan đến hồ sơ nếu có
    await run('DELETE FROM ratings WHERE application_id = ?', [req.params.id]).catch(() => {});
    // Xóa hồ sơ
    await run('DELETE FROM applications WHERE id = ?', [req.params.id]);

    // Thông báo cho nhà tuyển dụng (best effort)
    if (appRow.employer_id) {
      try {
        await createNotification({
          userId: appRow.employer_id,
          type: 'status_change',
          title: `Hồ sơ đã rút: ${appRow.applicant_name}`,
          body: `Ứng viên ${appRow.applicant_name} đã rút hồ sơ ứng tuyển vào vị trí "${appRow.job_title || 'công việc'}".`,
          linkType: 'job',
          linkId: appRow.job_id
        });
      } catch (notifErr) {
        console.warn('[Notification Warning]:', notifErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Đã hủy hồ sơ ứng tuyển thành công!',
      withdrawnId: req.params.id,
      jobId: appRow.job_id
    });
  } catch (error) {
    console.error('Lỗi hủy hồ sơ:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi hủy hồ sơ' });
  }
});

/**
 * GET /api/applications/:id/cv
 * Tải file CV an toàn (Chỉ ứng viên nộp hồ sơ, NTD sở hữu tin tuyển dụng hoặc Admin)
 */
router.get('/:id/cv', authenticateToken, async (req, res) => {
  try {
    const appId = req.params.id;
    const appRow = await get(`
      SELECT a.*, j.employer_id, j.title as job_title 
      FROM applications a 
      LEFT JOIN jobs j ON a.job_id = j.id 
      WHERE a.id = ?
    `, [appId]);

    if (!appRow) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ ứng tuyển' });
    }

    // Phân quyền bảo mật: Chỉ ứng viên sở hữu đơn, NTD sở hữu job hoặc Admin
    const isApplicantOwner = req.user.id === appRow.user_id;
    const isEmployerOwner = (req.user.role === 'employer' || req.user.role === 'admin') && (req.user.id === appRow.employer_id || req.user.role === 'admin');

    if (!isApplicantOwner && !isEmployerOwner) {
      return res.status(403).json({
        success: false,
        message: 'Từ chối quyền (403 Forbidden): Bạn không có quyền truy cập file CV của ứng viên này!'
      });
    }

    if (!appRow.cv_file_path) {
      return res.status(404).json({ success: false, message: 'Hồ sơ này không đính kèm file CV vật lý' });
    }

    const safeFilename = path.basename(appRow.cv_file_path);
    const fullPath = path.join(CV_UPLOAD_DIR, safeFilename);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'File CV không còn tồn tại trên hệ thống lưu trữ' });
    }

    const downloadName = (appRow.cv_name || safeFilename).replace(/[^a-zA-Z0-9._\-]/g, '_');

    observability.logAudit({
      action: 'CV_DOWNLOAD',
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: appId,
      details: {
        applicantId: appRow.user_id,
        jobId: appRow.job_id,
        jobTitle: appRow.job_title,
        filename: safeFilename
      },
      ip: req.ip
    });

    // ☁️ AWS S3 Private Bucket: Nếu client yêu cầu Pre-signed URL
    if (req.query.presigned === 'true' || req.query.format === 'json') {
      const s3Key = `cv/${appRow.user_id || 'anon'}/${safeFilename}`;
      const presignedUrl = await getPresignedUrl(s3Key, 900);
      return res.json({
        success: true,
        presignedUrl,
        filename: downloadName,
        expiresInSeconds: 900
      });
    }

    res.download(fullPath, downloadName);
  } catch (error) {
    console.error('Lỗi tải file CV:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải file CV' });
  }
});

/**
 * GET /api/applications/:id/cv-url
 * Lấy Pre-signed URL có thời hạn (15 phút) cho file CV của đơn ứng tuyển
 */
router.get('/:id/cv-url', authenticateToken, async (req, res) => {
  try {
    const appId = req.params.id;
    const appRow = await get(`
      SELECT a.*, j.employer_id, j.title as job_title 
      FROM applications a 
      LEFT JOIN jobs j ON a.job_id = j.id 
      WHERE a.id = ?
    `, [appId]);

    if (!appRow) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ ứng tuyển' });
    }

    const isApplicantOwner = req.user.id === appRow.user_id;
    const isEmployerOwner = (req.user.role === 'employer' || req.user.role === 'admin') && (req.user.id === appRow.employer_id || req.user.role === 'admin');

    if (!isApplicantOwner && !isEmployerOwner) {
      return res.status(403).json({
        success: false,
        message: 'Từ chối quyền: Bạn không có quyền truy cập file CV này!'
      });
    }

    if (!appRow.cv_file_path) {
      return res.status(404).json({ success: false, message: 'Hồ sơ này không đính kèm file CV' });
    }

    const safeFilename = path.basename(appRow.cv_file_path);
    const s3Key = `cv/${appRow.user_id || 'anon'}/${safeFilename}`;
    const presignedUrl = await getPresignedUrl(s3Key, 900);

    res.json({
      success: true,
      presignedUrl,
      fileName: appRow.cv_name || safeFilename,
      expiresInSeconds: 900
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi tạo Pre-signed URL cho CV' });
  }
});

export default router;

