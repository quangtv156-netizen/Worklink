import nodemailer from 'nodemailer';

/**
 * Kiểm tra xem dịch vụ SMTP đã được cấu hình hay chưa
 */
export function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Tạo SMTP Transporter với pool, timeout và bảo mật TLS
 */
export function getTransporter() {
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 10000, // 10s
    socketTimeout: 15000 // 15s
  });
}

/**
 * Kiểm tra tính hợp lệ của cấu hình SMTP kết nối thực tế
 */
export async function verifySmtpConnection() {
  if (!isSmtpConfigured()) {
    return { configured: false, message: 'SMTP chưa được cấu hình biến môi trường' };
  }
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log('✅ [SMTP Service] Kết nối máy chủ SMTP thành công!');
    return { configured: true, connected: true };
  } catch (error) {
    console.error('❌ [SMTP Service] Kết nối máy chủ SMTP thất bại:', error.message);
    return { configured: true, connected: false, error: error.message };
  }
}

/**
 * Gửi email đặt lại mật khẩu cho người dùng
 * Nếu đã cấu hình SMTP trong .env: Gửi email thật qua SMTP (Gmail/SendGrid/SES/v.v.)
 * Nếu chưa cấu hình SMTP: Ghi log an toàn ra server console (dành cho môi trường dev)
 */
export async function sendPasswordResetEmail({ toEmail, userName, resetToken }) {
  if (isSmtpConfigured()) {
    try {
      const transporter = getTransporter();
      const sender = process.env.EMAIL_FROM || `"WorkLink Security" <${process.env.SMTP_USER}>`;

      await transporter.sendMail({
        from: sender,
        to: toEmail,
        subject: '[WorkLink] Hướng dẫn và mã xác thực đặt lại mật khẩu',
        text: `Xin chào ${userName},\n\nHệ thống WorkLink nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.\nMã xác thực của bạn là: ${resetToken}\n(Hiệu lực trong 15 phút, sử dụng một lần duy nhất).\n\nNếu bạn không yêu cầu, vui lòng bỏ qua email này.\nTrân trọng,\nĐội ngũ WorkLink.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #4f46e5; margin: 0;">WorkLink</h2>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Nền tảng Tuyển dụng & Kết nối Việc làm</p>
            </div>
            
            <p style="font-size: 15px; color: #1e293b;">Xin chào <strong>${userName}</strong>,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              Hệ thống WorkLink nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã xác thực bên dưới để hoàn tất việc đổi mật khẩu mới:
            </p>
            
            <div style="margin: 24px 0; padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center;">
              <span style="font-family: monospace; font-size: 20px; font-weight: bold; color: #0f172a; letter-spacing: 1px;">
                ${resetToken}
              </span>
            </div>
            
            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
              ⏱️ <em>Mã xác thực có hiệu lực trong vòng <strong>15 phút</strong> và chỉ được sử dụng duy nhất một lần (single-use).</em>
            </p>
            <p style="font-size: 13px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
              Nếu bạn không yêu cầu đặt lại mật khẩu, xin hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn tuyệt đối.
            </p>
          </div>
        `
      });

      console.log(`[Email Service] ✅ Đã gửi email đặt lại mật khẩu thật tới: ${toEmail}`);
      return { success: true, mode: 'smtp' };
    } catch (err) {
      console.error(`[Email Service] ❌ Lỗi khi gửi email qua SMTP tới ${toEmail}:`, err.message);
    }
  }

  // Fallback dành cho môi trường Local / Demo đồ án (hoặc khi chưa cấu hình SMTP)
  const isProd = process.env.NODE_ENV === 'production';
  console.log(`\n======================================================`);
  console.log(`[AUTH SERVICE - SIMULATED EMAIL DISPATCH (DEMO/NO SMTP)]`);
  console.log(`To: ${toEmail} (Họ tên: ${userName})`);
  console.log(`Subject: [WorkLink] Hướng dẫn & Mã xác thực đặt lại mật khẩu`);
  if (!isProd) {
    console.log(`Reset Token: ${resetToken}`);
  } else {
    console.log(`Reset Token: [BẢO MẬT: Đã ẩn trong Production - Vui lòng cấu hình SMTP để gửi email thật]`);
  }
  console.log(`Hiệu lực: 15 phút (Single-use token)`);
  if (isProd) {
    console.warn(`⚠️ [PRODUCTION DEPLOY NOTE] Chưa phát hiện cấu hình SMTP trong biến môi trường. Để gửi email thực tế cho người dùng ngoài đời thực, hãy thiết lập SMTP_HOST, SMTP_USER, SMTP_PASS trong file .env hoặc Dashboard Render/Railway.`);
  }
  console.log(`======================================================\n`);

  return { success: true, mode: 'console' };
}

/**
 * Gửi email xác thực tài khoản (Email Verification)
 */
export async function sendVerificationEmail({ toEmail, userName, verificationToken }) {
  const verifyUrl = `${process.env.APP_URL || 'http://localhost:5173'}/verify-email?token=${encodeURIComponent(verificationToken)}`;

  if (isSmtpConfigured()) {
    try {
      const transporter = getTransporter();
      const sender = process.env.EMAIL_FROM || `"WorkLink Security" <${process.env.SMTP_USER}>`;

      await transporter.sendMail({
        from: sender,
        to: toEmail,
        subject: '[WorkLink] Xác thực địa chỉ email tài khoản của bạn',
        text: `Xin chào ${userName},\n\nVui lòng xác thực địa chỉ email để kích hoạt đầy đủ quyền nộp hồ sơ và liên hệ nhà tuyển dụng trên WorkLink:\n${verifyUrl}\n\nTrân trọng,\nĐội ngũ WorkLink.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #4f46e5; margin: 0;">WorkLink</h2>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Xác thực tài khoản người dùng</p>
            </div>
            <p style="font-size: 15px; color: #1e293b;">Xin chào <strong>${userName}</strong>,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              Cảm ơn bạn đã tham gia WorkLink. Vui lòng nhấn vào nút bên dưới để xác thực địa chỉ email và kích hoạt tính năng nộp CV cũng như nhắn tin trực tiếp:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${verifyUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                Xác thực Email ngay
              </a>
            </div>
            <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">
              Nếu nút bấm không hoạt động, bạn có thể truy cập liên kết: <br/>${verifyUrl}
            </p>
          </div>
        `
      });

      console.log(`[Email Service] ✅ Đã gửi email xác thực tài khoản tới: ${toEmail}`);
      return { success: true, mode: 'smtp' };
    } catch (err) {
      console.error(`[Email Service] ❌ Lỗi gửi email xác thực qua SMTP tới ${toEmail}:`, err.message);
    }
  }

  console.log(`[SIMULATED EMAIL VERIFICATION] To: ${toEmail} | URL: ${verifyUrl}`);
  return { success: true, mode: 'console' };
}
