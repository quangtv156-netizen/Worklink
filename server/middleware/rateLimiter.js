import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';
const isDisabled = process.env.RATE_LIMIT_DISABLED === 'true';

/**
 * Key Generator ưu tiên User ID hoặc API Key thay vì chỉ dùng IP (M3)
 * Thứ tự ưu tiên:
 * 1. User ID (nếu đã authenticate) -> Phạt đúng tài khoản lạm dụng
 * 2. API Key (x-api-key / apikey header)
 * 3. Email đối với login request (ngăn chặn brute-force tài khoản mục tiêu)
 * 4. IP client fallback
 */
export const userOrKeyOrIpGenerator = (req) => {
  // 1. Ưu tiên User ID đã đăng nhập
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  // 2. Ưu tiên API Key từ headers
  const apiKey = req.headers['x-api-key'] || req.headers['apikey'];
  if (apiKey && typeof apiKey === 'string') {
    return `key:${apiKey.trim()}`;
  }

  // 3. Với endpoint login: kết hợp email và IP
  if (req.body?.email && typeof req.body.email === 'string') {
    const cleanEmail = req.body.email.toLowerCase().trim();
    const clientIp = req.ip || (typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : 'client');
    return `login:${cleanEmail}_${clientIp}`;
  }

  // 4. Fallback theo IP
  return `ip:${req.ip || (typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : 'unknown_client')}`;
};

const authMax = parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || (isTest ? 1000 : 100);
const loginMax = parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || (isTest ? 1000 : 15);
const generalMax = parseInt(process.env.GENERAL_RATE_LIMIT_MAX, 10) || (isTest ? 10000 : 2000);
const cvAnalyzeMax = parseInt(process.env.CV_ANALYZE_RATE_LIMIT_MAX, 10) || (isTest ? 1000 : 30);
const aiMax = parseInt(process.env.AI_RATE_LIMIT_MAX, 10) || (isTest ? 1000 : 40);

/**
 * Rate limiter chung cho nhóm xác thực (/api/auth)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrKeyOrIpGenerator,
  validate: { keyGeneratorIpFallback: false },
  skip: (req) => isDisabled || (isTest && req.headers['x-test-suite'] === 'true'),
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau 15 phút.'
  },
  statusCode: 429
});

/**
 * 🔒 Rate Limiter riêng cho /api/auth/login (Chống Brute Force mật khẩu)
 * Ưu tiên nhận diện theo Email + IP (hoặc User ID)
 * Giới hạn: Tối đa 15 lần thử trong 15 phút
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: loginMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrKeyOrIpGenerator,
  validate: { keyGeneratorIpFallback: false },
  skip: (req) => isDisabled || (isTest && req.headers['x-test-suite'] === 'true'),
  message: {
    success: false,
    message: 'Quá nhiều lần đăng nhập không thành công cho tài khoản/IP này. Vui lòng thử lại sau 15 phút.'
  },
  statusCode: 429
});

/**
 * 🤖 Rate Limiter riêng cho các endpoint AI nặng: /api/cv/analyze, /api/ai/analyze-cv (Gemini API)
 * Ưu tiên nhận diện theo User ID hoặc API Key
 * Giới hạn: Tối đa 30 lần quét CV trong 15 phút để bảo vệ quota Gemini & tài nguyên CPU
 */
export const cvAnalyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: cvAnalyzeMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrKeyOrIpGenerator,
  validate: { keyGeneratorIpFallback: false },
  skip: (req) => isDisabled || (isTest && req.headers['x-test-suite'] === 'true'),
  message: {
    success: false,
    message: 'Bạn đã đạt giới hạn phân tích CV (Gemini AI) trong 15 phút. Vui lòng chờ giây lát để hệ thống hồi phục hạn mức.'
  },
  statusCode: 429
});

/**
 * Rate limiter cho AI Copilot / RAG chat
 */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: aiMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrKeyOrIpGenerator,
  validate: { keyGeneratorIpFallback: false },
  skip: (req) => isDisabled || (isTest && req.headers['x-test-suite'] === 'true'),
  message: {
    success: false,
    message: 'Bạn đã đạt giới hạn sử dụng AI Copilot trong 15 phút. Vui lòng quay lại sau ít phút.'
  },
  statusCode: 429
});

/**
 * Rate limiter chung cho toàn bộ API
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: generalMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrKeyOrIpGenerator,
  validate: { keyGeneratorIpFallback: false },
  skip: (req) => isDisabled || (isTest && req.headers['x-test-suite'] === 'true'),
  message: {
    success: false,
    message: 'Hệ thống nhận thấy lưu lượng truy cập bất thường từ tài khoản/IP của bạn. Vui lòng thử lại sau.'
  },
  statusCode: 429
});
