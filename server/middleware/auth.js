import jwt from 'jsonwebtoken';
import { get } from '../db.js';

const INSECURE_DEFAULT_SECRETS = [
  'worklink-super-secret-key-2026',
  'worklink-super-secure-production-key-2026',
  'your-super-secret-jwt-key-change-this-in-production-min-32-chars'
];

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || INSECURE_DEFAULT_SECRETS.includes(process.env.JWT_SECRET) || process.env.JWT_SECRET.length < 32)) {
  console.error('❌ [BẢO MẬT BẮT BUỘC] Không thể khởi động trên Production với JWT_SECRET mặc định hoặc không an toàn (< 32 ký tự)! Chạy "npm run secret:generate" để tạo khóa bí mật an toàn.');
  process.exit(1);
}

export const JWT_SECRET = process.env.JWT_SECRET || 'worklink-super-secret-key-2026';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.worklink_jwt_token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Yêu cầu xác thực tài khoản (Thiếu JWT token)' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err || !decoded?.id) {
      // 401 Unauthorized = token không hợp lệ hoặc hết hạn
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
    }

    try {
      // Kiểm tra DB để đảm bảo tài khoản tồn tại, chưa bị xóa mềm và lấy role mới nhất
      const dbUser = await get('SELECT id, name, email, role, phone, district, city, title, is_verified, token_version FROM users WHERE id = ? AND deleted_at IS NULL', [decoded.id]);
      if (!dbUser) {
        return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.' });
      }

      // Kiểm tra token_version để hủy token cũ khi người dùng đổi/reset mật khẩu hoặc xóa tài khoản
      if (decoded.tokenVersion && dbUser.token_version && decoded.tokenVersion !== dbUser.token_version) {
        return res.status(401).json({
          success: false,
          message: 'Phiên đăng nhập đã hết hạn do mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.'
        });
      }

      req.user = { ...decoded, ...dbUser };
      next();
    } catch (dbErr) {
      console.error('Lỗi xác thực người dùng từ DB:', dbErr);
      // 🔒 Fail closed: Không chấp nhận fallback token để tránh chiếm quyền khi DB chập chờn
      return res.status(503).json({
        success: false,
        message: 'Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.'
      });
    }
  });
};

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.worklink_jwt_token;

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (!err && decoded?.id) {
      try {
        const dbUser = await get('SELECT id, name, email, role, phone, district, city, title, is_verified, token_version FROM users WHERE id = ? AND deleted_at IS NULL', [decoded.id]);
        if (dbUser && (!decoded.tokenVersion || !dbUser.token_version || decoded.tokenVersion === dbUser.token_version)) {
          req.user = { ...decoded, ...dbUser };
        } else {
          req.user = null;
        }
      } catch {
        req.user = null;
      }
    } else {
      req.user = null;
    }
    next();
  });
};

/**
 * RBAC Middleware: Yêu cầu người dùng có một trong các vai trò được chỉ định
 * @param  {...string} allowedRoles Ví dụ: 'employer', 'admin'
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.' 
      });
    }

    const userRole = req.user.role || 'job_seeker';
    if (!allowedRoles.includes(userRole)) {
      const roleLabels = {
        job_seeker: 'Ứng viên',
        employer: 'Nhà tuyển dụng',
        admin: 'Quản trị viên'
      };
      const requiredText = allowedRoles.map(r => roleLabels[r] || r).join(' hoặc ');
      return res.status(403).json({ 
        success: false, 
        message: `Từ chối truy cập (403 Forbidden): Chức năng này yêu cầu quyền [${requiredText}]. Vai trò hiện tại của bạn là [${roleLabels[userRole] || userRole}].` 
      });
    }

    next();
  };
};

/** Shortcut: Chỉ Nhà tuyển dụng hoặc Admin */
export const requireEmployerOrAdmin = requireRole('employer', 'admin');

/** Shortcut: Chỉ Quản trị viên */
export const requireAdmin = requireRole('admin');

