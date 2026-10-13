import express from 'express';
import fs from 'fs';
import path from 'path';
import { query, get, run } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { observability } from '../services/observability.js';
import { storageService } from '../services/storageService.js';
import { recordAuditLog } from '../services/auditLogger.js';

const CV_UPLOAD_DIR = process.env.CV_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'cv');

const router = express.Router();

/**
 * ============================================================
 * WORKLINK USER & DATA PRIVACY ROUTES (PDPA / GDPR S4)
 * ============================================================
 * 1. GET    /api/users/me        - Lấy thông tin tài khoản & hạn mức AI Quota
 * 2. GET    /api/users/me/export - Xuất toàn bộ dữ liệu người dùng ra JSON file
 * 3. DELETE /api/users/me        - Xóa mềm tài khoản (Soft Delete) & dữ liệu liên quan
 */

/**
 * GET /api/users/me
 * Xem thông tin hồ sơ cá nhân và hạn mức AI Quota hiện tại
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRow = await get(
      `SELECT id, name, email, role, phone, district, city, title, bio, skills, 
              preferred_shift, expected_salary, cv_name, avatar, is_verified, 
              ai_quota, deleted_at, created_at 
       FROM users 
       WHERE id = ? AND deleted_at IS NULL`,
      [userId]
    );

    if (!userRow) {
      return res.status(404).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc đã bị xóa.'
      });
    }

    res.json({
      success: true,
      user: {
        ...userRow,
        aiQuota: userRow.ai_quota !== null ? userRow.ai_quota : 5
      }
    });
  } catch (error) {
    console.error('[User Router Error] Lỗi lấy thông tin me:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * GET /api/users/me/export
 * Xuất toàn bộ dữ liệu cá nhân của user ra file JSON (PDPA / GDPR Right to Data Portability)
 */
router.get('/me/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Thông tin tài khoản & hồ sơ (Tuyệt đối KHÔNG xuất password_hash hoặc 2FA secret vì lý do an ninh)
    const profile = await get(
      `SELECT id, name, email, role, phone, district, city, title, bio, skills, 
              preferred_shift, expected_salary, cv_name, avatar, is_verified, 
              ai_quota, created_at 
       FROM users 
       WHERE id = ? AND deleted_at IS NULL`,
      [userId]
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc đã bị xóa.'
      });
    }

    // 2. Toàn bộ đơn ứng tuyển (Job Applications)
    const applications = await query(
      `SELECT id, job_id, applicant_name, phone, email, note, cv_name, status, created_at 
       FROM applications 
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );

    // 3. Toàn bộ hồ sơ CV đã phân tích (CV Analyses History)
    const cvAnalyses = await query(
      `SELECT id, cv_name, ats_score, summary, strengths, improvements, breakdown, matched_jobs, created_at 
       FROM cv_analyses 
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );

    // 4. Các nhiệm vụ việc vặt (Gigs) do user tạo hoặc tham gia
    const gigs = await query(
      `SELECT id, title, reward, cargo_type, status, created_at 
       FROM gig_tasks 
       WHERE employer_id = ? OR accepted_by = ?
       ORDER BY created_at DESC`,
      [userId, userId]
    );

    // 5. Dự án Freelance & Đề xuất (Proposals)
    const freelanceProjects = await query(
      `SELECT id, title, client, budget, duration, category, status, created_at 
       FROM freelance_projects 
       WHERE employer_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    const proposals = await query(
      `SELECT * FROM freelance_proposals 
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    // 6. Đánh giá & Phản hồi (Ratings)
    const ratings = await query(
      `SELECT * FROM ratings 
       WHERE reviewer_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    // 7. Tin tuyển dụng đã lưu (Bookmarks)
    const bookmarks = await query(
      `SELECT id, job_id, created_at 
       FROM job_bookmarks 
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    const exportPayload = {
      success: true,
      platform: 'WorkLink Recruitment & Job Network',
      exportStandard: 'PDPA / GDPR Right to Data Portability',
      exportTimestamp: new Date().toISOString(),
      user: profile,
      data: {
        applications,
        cvAnalyses,
        gigs,
        freelanceProjects,
        proposals,
        ratings,
        bookmarks
      }
    };

    // Thiết lập Header tải xuống file JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="worklink-user-data-export-${userId}.json"`);

    observability.logAudit({
      action: 'USER_DATA_EXPORT_PDPA',
      actorId: userId,
      actorRole: req.user.role,
      targetId: userId,
      details: { email: req.user.email },
      ip: req.ip
    });

    return res.json(exportPayload);
  } catch (error) {
    console.error('[User Router Error] Lỗi xuất dữ liệu cá nhân:', error);
    res.status(500).json({ success: false, message: 'Lỗi xuất dữ liệu người dùng' });
  }
});

/**
 * DELETE /api/users/me
 * Cơ chế Soft Delete (xóa mềm) tài khoản, toàn bộ hồ sơ CV và đơn ứng tuyển liên quan
 * Tuân thủ quy chuẩn quyền riêng tư PDPA / GDPR (S4)
 */
router.delete('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Không thể tự xoá tài khoản Quản trị viên hệ thống!'
      });
    }

    // 1. Soft Delete User: Ghi nhận deleted_at và tăng token_version để vô hiệu hóa toàn bộ JWT tokens hiện tại
    await run(
      `UPDATE users 
       SET deleted_at = CURRENT_TIMESTAMP, 
           token_version = COALESCE(token_version, 1) + 1 
       WHERE id = ?`,
      [userId]
    );

    // 2. Ẩn danh toàn bộ tin nhắn Chat: Chuyển tên người gửi thành '[Tài khoản đã xóa]'
    await run(
      `UPDATE chat_messages 
       SET sender_name = '[Tài khoản đã xóa]' 
       WHERE sender_id = ?`,
      [userId]
    ).catch(() => {});

    // 3. Xóa / ẩn vật lý toàn bộ file CV trên ổ cứng cục bộ và AWS S3 (Right to be Forgotten - PDPA/GDPR)
    try {
      // 3.1. File đính kèm trong các đơn ứng tuyển (applications)
      const appRows = await query('SELECT cv_file_path FROM applications WHERE user_id = ?', [userId]);
      for (const row of appRows) {
        if (row.cv_file_path) {
          await storageService.deleteFile(row.cv_file_path).catch(() => {});
          const directLocal = path.join(CV_UPLOAD_DIR, path.basename(row.cv_file_path));
          if (fs.existsSync(directLocal)) {
            try { await fs.promises.unlink(directLocal); } catch {}
          }
        }
      }

      // 3.2. File CV trong lịch sử phân tích (cv_analyses)
      const cvaRows = await query('SELECT cv_name FROM cv_analyses WHERE user_id = ?', [userId]);
      for (const row of cvaRows) {
        if (row.cv_name) {
          await storageService.deleteFile(row.cv_name).catch(() => {});
          const directLocal = path.join(CV_UPLOAD_DIR, path.basename(row.cv_name));
          if (fs.existsSync(directLocal)) {
            try { await fs.promises.unlink(directLocal); } catch {}
          }
        }
      }

      // 3.3. File CV tải lên trong hồ sơ cá nhân
      const userProfile = await get('SELECT cv_name, avatar FROM users WHERE id = ?', [userId]);
      if (userProfile?.cv_name) {
        await storageService.deleteFile(userProfile.cv_name).catch(() => {});
        const directLocal = path.join(CV_UPLOAD_DIR, path.basename(userProfile.cv_name));
        if (fs.existsSync(directLocal)) {
          try { await fs.promises.unlink(directLocal); } catch {}
        }
      }
    } catch (purgeErr) {
      console.warn('[PDPA File Purge Error]:', purgeErr.message);
    }

    // 4. Soft Delete toàn bộ Hồ sơ CV đã phân tích (cv_analyses)
    await run(
      `UPDATE cv_analyses 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE user_id = ?`,
      [userId]
    ).catch(() => {});

    // 5. Soft Delete toàn bộ Đơn ứng tuyển liên quan (applications)
    await run(
      `UPDATE applications 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE user_id = ?`,
      [userId]
    ).catch(() => {});

    // 6. Dọn dẹp session cookies
    res.clearCookie('worklink_jwt_token', { path: '/' });
    res.clearCookie('worklink_refresh_token', { path: '/' });

    // 7. Ghi Audit Log vào CSDL bảng audit_logs & hệ thống Observability
    await recordAuditLog({
      adminId: userId,
      action: 'USER_ACCOUNT_SOFT_DELETE',
      targetId: userId,
      details: {
        email: req.user.email,
        role: req.user.role,
        chatAnonymized: true,
        cvPurged: true,
        type: 'PDPA_SOFT_DELETE'
      },
      req
    });

    console.log(`[PDPA Service] 🛡️ Đã thực hiện Soft Delete thành công cho tài khoản: ${userId} (${req.user.email})`);

    return res.json({
      success: true,
      message: 'Tài khoản và toàn bộ hồ sơ CV, đơn ứng tuyển liên quan đã được xóa mềm thành công theo quy chuẩn bảo vệ quyền riêng tư (PDPA).'
    });
  } catch (error) {
    console.error('[User Router Error] Lỗi xóa mềm tài khoản:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa tài khoản' });
  }
});

export default router;
