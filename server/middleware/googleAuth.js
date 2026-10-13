import { OAuth2Client } from 'google-auth-library';

const isProduction = process.env.NODE_ENV === 'production';
let googleOAuthClient = null;

if (process.env.GOOGLE_CLIENT_ID) {
  googleOAuthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
}

/**
 * Middleware: Xác thực Google ID Token (H2 & H3)
 * Sử dụng google-auth-library chính chủ từ Google.
 * Bắt buộc kiểm tra aud, exp, iss và cấu hình môi trường.
 */
export async function verifyGoogleTokenMiddleware(req, res, next) {
  try {
    const { credential, email, name, avatar } = req.body;
    const clientId = process.env.GOOGLE_CLIENT_ID;

    // 🔒 Kiểm tra Production: Bắt buộc cấu hình GOOGLE_CLIENT_ID
    if (isProduction && !clientId) {
      console.error('❌ [BẢO MẬT] GOOGLE_CLIENT_ID chưa được cấu hình trên môi trường Production!');
      return res.status(500).json({
        success: false,
        message: 'Lỗi cấu hình hệ thống: GOOGLE_CLIENT_ID chưa được thiết lập trên môi trường Production.'
      });
    }

    // 🔒 Kiểm tra Production: Tuyệt đối cấm Mock Login (bắt buộc phải có Google ID Token credential)
    if (isProduction && !credential) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu Google ID Token (credential). Môi trường Production không cho phép Mock Login.'
      });
    }

    // Trường hợp 1: Có credential (Google ID Token thật từ GIS)
    if (credential) {
      if (!googleOAuthClient && clientId) {
        googleOAuthClient = new OAuth2Client(clientId);
      }

      let payload = null;

      if (googleOAuthClient && clientId) {
        // Xác thực chính quy bằng google-auth-library
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken: credential,
          audience: clientId
        });
        payload = ticket.getPayload();
      } else {
        // Fallback môi trường Development nếu chưa điền GOOGLE_CLIENT_ID: xác thực qua Google tokeninfo API
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (!verifyRes.ok) {
          return res.status(401).json({
            success: false,
            message: 'Google ID Token không hợp lệ hoặc đã hết hạn.'
          });
        }
        payload = await verifyRes.json();
      }

      if (!payload || !payload.email) {
        return res.status(401).json({
          success: false,
          message: 'Không thể trích xuất thông tin người dùng từ Google ID Token.'
        });
      }

      // Kiểm tra audience (aud)
      if (clientId && payload.aud !== clientId) {
        return res.status(401).json({
          success: false,
          message: 'Google ID Token không hợp lệ (audience không khớp).'
        });
      }

      // Kiểm tra hạn sử dụng (exp)
      const currentEpoch = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < currentEpoch) {
        return res.status(401).json({
          success: false,
          message: 'Google ID Token đã hết hạn.'
        });
      }

      // Kiểm tra issuer (iss)
      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (payload.iss && !validIssuers.includes(payload.iss)) {
        return res.status(401).json({
          success: false,
          message: 'Google ID Token nguồn phát hành không hợp lệ.'
        });
      }

      req.googleUser = {
        email: payload.email.toLowerCase().trim(),
        name: (payload.name || '').trim(),
        avatar: payload.picture || null,
        emailVerified: payload.email_verified !== false
      };
      return next();
    }

    // Trường hợp 2: Chỉ áp dụng trong DEV khi bật cờ MOCK rõ ràng
    if (!isProduction && (process.env.ALLOW_MOCK_GOOGLE_AUTH === 'true' || process.env.VITE_ALLOW_MOCK_GOOGLE === 'true')) {
      if (!email) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email tài khoản Google dev mock.' });
      }
      req.googleUser = {
        email: email.toLowerCase().trim(),
        name: (name || '').trim(),
        avatar: avatar || null,
        emailVerified: true
      };
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Yêu cầu Google ID Token hợp lệ từ Google Identity Services.'
    });
  } catch (error) {
    console.error('❌ [Google Auth Middleware Error]:', error.message);
    return res.status(401).json({
      success: false,
      message: `Xác thực Google thất bại: ${error.message}`
    });
  }
}
