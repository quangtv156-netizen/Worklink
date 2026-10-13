/**
 * Middleware: Kiểm tra tài khoản đã xác thực email (M2)
 * Bắt buộc user phải có is_verified = 1 trước khi:
 * - Nộp đơn ứng tuyển CV (POST /api/applications)
 * - Nhắn tin trao đổi (POST /api/chat)
 */
export function requireVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu đăng nhập tài khoản để thực hiện hành động này.'
    });
  }

  // Khi biến REQUIRE_EMAIL_VERIFICATION được bật trong .env hoặc trên Production
  const isEnforced = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

  if (isEnforced) {
    const isVerified = req.user.is_verified === 1 || req.user.is_verified === true;
    if (!isVerified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Tài khoản của bạn chưa xác thực email. Vui lòng xác thực địa chỉ email để nộp CV hoặc nhắn tin trao đổi.'
      });
    }
  }

  next();
}
