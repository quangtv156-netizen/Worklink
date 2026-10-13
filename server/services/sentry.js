import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN || null;
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Cấu hình khởi tạo Sentry Error Tracking cho Backend Express
 */
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: isProduction ? 0.2 : 1.0,
    debug: !isProduction && process.env.DEBUG === 'true'
  });
  console.log('[Sentry] 📡 Đã kích hoạt @sentry/node giám sát lỗi thời gian thực');
} else {
  console.log('[Sentry] ℹ️ SENTRY_DSN chưa được cấu hình. Lỗi sẽ được ghi vào console logger chuẩn.');
}

/**
 * Error Handler Middleware cho Express
 * Tự động bắt mọi unhandled error trong Express pipeline,
 * gửi stack trace và context (Request ID, URL, User) lên Sentry,
 * và trả về phản hồi lỗi an toàn cho client.
 */
export function sentryErrorHandler(err, req, res, next) {
  // Gửi ngoại lệ lên Sentry nếu DSN được cung cấp
  if (SENTRY_DSN) {
    try {
      Sentry.withScope((scope) => {
        scope.setTag('http.method', req.method);
        scope.setTag('http.url', req.originalUrl || req.path);
        scope.setExtra('requestId', req.id || req.headers['x-request-id'] || 'unknown');
        if (req.user) {
          scope.setUser({
            id: req.user.id,
            role: req.user.role
          });
        }
        Sentry.captureException(err);
      });
    } catch (sentryErr) {
      console.warn('[Sentry] Lỗi khi gửi sự kiện lên Sentry:', sentryErr.message);
    }
  }

  // Chuyển tiếp tới error handler tiếp theo nếu header đã được gửi
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: isProduction && statusCode === 500
      ? 'Đã xảy ra sự cố nội bộ máy chủ. Đội ngũ kỹ thuật đã được thông báo để xử lý.'
      : err.message || 'Lỗi máy chủ',
    requestId: req.id || req.headers['x-request-id'] || null
  });
}

/**
 * Helper hàm gửi ngoại lệ thủ công từ bất kỳ service nào
 */
export function captureException(error, context = {}) {
  if (SENTRY_DSN) {
    try {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        Sentry.captureException(error);
      });
    } catch {}
  }
}

export { Sentry };
