import { get } from "../db.js";
import {
  isProfileComplete,
  PROFILE_COMPLETENESS_COLUMNS,
} from "../services/profileCompleteness.js";

/**
 * Chặn người tìm việc (job_seeker) chưa khai báo đủ thông tin cơ bản.
 * Phải đặt SAU optionalAuth/authenticateToken (cần req.user).
 * Khách chưa đăng nhập và employer/admin được đi tiếp.
 *
 * Khi chạy bộ test tự động (NODE_ENV=test) thì bỏ qua, vì các test đăng ký
 * tài khoản mới rồi gọi API ngay. Muốn test chính cổng này, đặt PROFILE_GATE_ENFORCE=true.
 */
export const requireCompleteProfile = async (req, res, next) => {
  try {
    if (
      process.env.NODE_ENV === "test" &&
      process.env.PROFILE_GATE_ENFORCE !== "true"
    ) {
      return next();
    }
    if (!req.user || req.user.role !== "job_seeker") return next();

    const row = await get(
      `SELECT ${PROFILE_COMPLETENESS_COLUMNS} FROM users WHERE id = ? AND deleted_at IS NULL`,
      [req.user.id],
    );
    if (isProfileComplete(row)) return next();

    return res.status(403).json({
      success: false,
      code: "PROFILE_INCOMPLETE",
      message:
        "Vui lòng hoàn tất thông tin cá nhân cơ bản trước khi sử dụng tính năng này.",
    });
  } catch (err) {
    console.error("[requireCompleteProfile] Lỗi kiểm tra hồ sơ:", err.message);
    // Fail closed: lỗi DB thì không cho đi tiếp
    return res.status(503).json({
      success: false,
      message: "Không kiểm tra được hồ sơ, vui lòng thử lại sau.",
    });
  }
};
