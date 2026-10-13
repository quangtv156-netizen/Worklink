import crypto from 'crypto';
import { run } from '../db.js';
import { observability } from './observability.js';

/**
 * ============================================================
 * WORKLINK AUDIT LOGGER SERVICE (Cụm 11)
 * ============================================================
 * Ghi lại toàn bộ thao tác quan trọng của Quản trị viên (Admin)
 * vào bảng audit_logs trong Cơ sở dữ liệu để phục vụ kiểm toán bảo mật.
 *
 * Yêu cầu: Chỉ ghi log SAU KHI thao tác DB chính đã thành công.
 * Phải bắt được IP và chi tiết thay đổi dưới dạng JSON.
 */

/**
 * Helper: Trích xuất địa chỉ IP chính xác từ Express Request
 * @param {import('express').Request} req
 * @returns {string}
 */
export function extractClientIp(req) {
  if (!req) return '127.0.0.1';
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const list = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return list.trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Ghi nhật ký kiểm toán vào CSDL
 * @param {Object} options
 * @param {string} [options.adminId] - ID của Admin thực hiện thao tác
 * @param {string} options.action - Tên hành động (vd: 'JOB_MODERATION', 'CHANGE_USER_ROLE')
 * @param {string} [options.targetId] - ID của đối tượng bị thay đổi (job_id, user_id, ...)
 * @param {Object|string} [options.details={}] - Dữ liệu chi tiết thay đổi (JSON)
 * @param {string} [options.ipAddress] - IP client
 * @param {import('express').Request} [options.req] - Express Request object (nếu có để tự động lấy adminId và IP)
 * @returns {Promise<{ success: boolean, logId?: string, error?: string }>}
 */
export async function recordAuditLog({
  adminId,
  action,
  targetId,
  details = {},
  ipAddress,
  req
} = {}) {
  try {
    const finalAdminId = adminId || req?.user?.id || 'system';
    const finalIp = ipAddress || extractClientIp(req);
    const logId = `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const serializedDetails = typeof details === 'string' ? details : JSON.stringify(details);
    const now = new Date().toISOString();

    // 1. Lưu vào CSDL
    await run(`
      INSERT INTO audit_logs (id, admin_id, action, target_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [logId, finalAdminId, action, targetId || null, serializedDetails, finalIp, now]);

    // 2. Đồng bộ sang Observability Tracing
    observability.logAudit({
      action,
      actorId: finalAdminId,
      actorRole: req?.user?.role || 'admin',
      targetId,
      details: typeof details === 'object' ? details : { raw: details },
      ip: finalIp
    });

    return { success: true, logId };
  } catch (err) {
    console.error('[Audit Logger Error] Không thể lưu log kiểm toán vào CSDL:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Middleware: Tự động ghi audit log SAU KHI response trả về thành công (HTTP 2xx)
 * @param {string} action
 * @param {Function} [targetIdExtractor] - (req) => targetId
 * @param {Function} [detailsExtractor] - (req, resBody) => details
 */
export function auditLogMiddleware(action, targetIdExtractor, detailsExtractor) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Chỉ ghi log khi thao tác chính trả về thành công (2xx và success != false)
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success !== false) {
        const targetId = targetIdExtractor ? targetIdExtractor(req) : (req.params?.id || null);
        const details = detailsExtractor ? detailsExtractor(req, body) : { params: req.params, body: req.body };

        recordAuditLog({
          adminId: req.user?.id,
          action,
          targetId,
          details,
          req
        }).catch((err) => {
          console.warn('[Audit Logger Middleware Error]:', err.message);
        });
      }

      return originalJson(body);
    };

    next();
  };
}

export default {
  recordAuditLog,
  auditLogMiddleware,
  extractClientIp
};
