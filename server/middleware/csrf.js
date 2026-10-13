import csurf from 'csurf';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Khởi tạo csurf engine với cấu hình HttpOnly Cookie an toàn
 */
const csurfEngine = csurf({
  cookie: {
    key: '_csrf',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  }
});

/**
 * CSRF Protection Middleware
 * Tích hợp csurf bảo vệ các endpoint POST/PUT/PATCH/DELETE khi sử dụng Cookie session.
 * 
 * Quy tắc hoạt động:
 * 1. Chỉ kích hoạt csurf khi biến môi trường CSRF_ENABLED=true (giúp dev local/test không bị block).
 * 2. GET /api/csrf-token luôn cung cấp token chuẩn qua req.csrfToken().
 * 3. Request sử dụng Authorization header (Bearer token) được miễn trừ theo chuẩn RFC 6750.
 */
export const csrfProtection = (req, res, next) => {
  // 1. Chỉ bật csurf khi biến môi trường CSRF_ENABLED=true
  if (process.env.CSRF_ENABLED !== 'true') {
    req.csrfToken = () => 'csrf-disabled';
    return next();
  }

  // 2. Endpoint lấy token: Luôn chạy csurfEngine để tạo secret cookie & gắn req.csrfToken()
  if (req.path === '/api/csrf-token' || req.path === '/csrf-token') {
    return csurfEngine(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  }

  // 3. Request sử dụng Authorization header (Bearer token) thì đã miễn nhiễm với CSRF
  if (req.headers['authorization']) {
    req.csrfToken = () => 'bearer-auth-exempt';
    return next();
  }

  // 4. Mọi request mutation (POST/PUT/PATCH/DELETE) còn lại sử dụng Cookie đều được bảo vệ
  csurfEngine(req, res, (err) => {
    if (err) {
      if (err.code === 'EBADCSRFTOKEN') {
        console.warn(`[CSRF Blocked] Yêu cầu ${req.method} ${req.path} bị từ chối: CSRF token không hợp lệ hoặc thiếu (Origin: ${req.headers['origin'] || 'none'})`);
        return res.status(403).json({
          success: false,
          code: 'EBADCSRFTOKEN',
          message: 'Yêu cầu bị từ chối do không vượt qua kiểm tra an toàn CSRF. Vui lòng tải lại trang và thử lại.'
        });
      }
      return next(err);
    }
    next();
  });
};

/**
 * Controller endpoint cung cấp CSRF token cho Frontend React SPA
 * GET /api/csrf-token
 */
export const getCsrfTokenHandler = (req, res) => {
  try {
    const token = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
    res.json({
      success: true,
      csrfToken: token
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Không thể tạo CSRF token'
    });
  }
};
