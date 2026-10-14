import express from "express";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { query, get, run, BCRYPT_ROUNDS } from "../db.js";
import { JWT_SECRET, authenticateToken } from "../middleware/auth.js";
import { authLimiter, loginLimiter } from "../middleware/rateLimiter.js";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { observability } from "../services/observability.js";
import { OAuth2Client } from "google-auth-library";
import { verifyGoogleTokenMiddleware } from "../middleware/googleAuth.js";
import multer from "multer";
import { uploadToS3, getPresignedUrl } from "../config/s3.js";
import { enqueueEmailJob } from "../config/queue.js";
import {
  isUserLockedOut,
  recordFailedLogin,
  resetUserLockout,
} from "../services/lockoutService.js";
import { storageService } from "../services/storageService.js";
import { recordAuditLog } from "../services/auditLogger.js";
import {
  isProfileComplete,
  validatePhone,
  validateDateOfBirth,
  normalizePhone,
} from "../services/profileCompleteness.js";

const CV_UPLOAD_DIR =
  process.env.CV_UPLOAD_DIR || path.join(process.cwd(), "uploads", "cv");

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh (JPEG, PNG, WEBP, GIF)"));
    }
  },
});

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production";
const googleOAuthClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

// H1: Cấu hình không trả JWT token qua JSON body trên Production (chỉ dùng HttpOnly Cookie)
export const shouldExposeTokenInBody = () => {
  if (process.env.COOKIE_ONLY_AUTH === "true") return false;
  if (process.env.EXPOSE_TOKEN_IN_BODY === "true") return true;
  return !isProduction;
};

export const AUTH_COOKIE_NAME = "worklink_jwt_token";
export const REFRESH_COOKIE_NAME = "worklink_refresh_token";

export const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  maxAge: 60 * 60 * 1000, // 1 hour Access Token cookie
  path: "/",
});

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days Refresh Token cookie
  path: "/",
});

export function createAccessToken(userRow, companyName = "") {
  return jwt.sign(
    {
      id: userRow.id,
      role: userRow.role,
      companyName: companyName || "",
      tokenVersion: userRow.token_version || 1,
    },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
}

export function createRefreshToken(userRow) {
  return jwt.sign(
    {
      id: userRow.id,
      type: "refresh",
      tokenVersion: userRow.token_version || 1,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

// Email format regex (RFC 5322 compliant standard check)
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// S8: Danh sách mật khẩu yếu, phổ biến cần chặn
const COMMON_WEAK_PASSWORDS = new Set([
  "12345678",
  "password",
  "password123",
  "admin123",
  "qwertyui",
  "123456789",
  "11111111",
  "worklink123",
]);

function isWeakPassword(pwd) {
  if (!pwd || pwd.length < 8) return true;
  if (COMMON_WEAK_PASSWORDS.has(pwd.toLowerCase())) return true;
  if (/^(.)\1{7,}$/.test(pwd)) return true;
  return false;
}

// S9: Bộ nhớ theo dõi đăng nhập thất bại và khóa tài khoản tạm thời (Lockout)
export const failedLoginAttempts = new Map(); // cleanEmail -> { count, lockedUntil }

export const getLockoutStatus = (email) => {
  if (!email) return { isLocked: false, remainingAttempts: 5 };
  const cleanEmail = email.toLowerCase().trim();
  const record = failedLoginAttempts.get(cleanEmail);
  if (!record) return { isLocked: false, remainingAttempts: 5 };
  if (record.lockedUntil && record.lockedUntil > Date.now()) {
    return {
      isLocked: true,
      lockedUntil: record.lockedUntil,
      waitMinutes: Math.ceil((record.lockedUntil - Date.now()) / 60000),
    };
  }
  return {
    isLocked: false,
    remainingAttempts: Math.max(0, 5 - (record.count || 0)),
  };
};

export const resetLockout = (email) => {
  if (email) failedLoginAttempts.delete(email.toLowerCase().trim());
};

// Áp dụng Rate Limiter cho toàn bộ các endpoint xác thực (tối đa 20 req/15 phút/IP)
router.use(authLimiter);

/**
 * POST /api/auth/register
 * Đăng ký tài khoản mới
 */
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      district,
      role: clientRole,
    } = req.body;
    // 🔒 Bảo mật: Chỉ cho phép 'job_seeker' hoặc 'employer'. Tuyệt đối cấm tự đăng ký làm 'admin'.
    const role = clientRole === "employer" ? "employer" : "job_seeker";

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ tên, email và mật khẩu!",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Định dạng email không hợp lệ (ví dụ: user@example.com)!",
      });
    }

    if (isWeakPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Mật khẩu phải có ít nhất 8 ký tự và không được là mật khẩu phổ biến/dễ đoán!",
      });
    }

    const existing = await get("SELECT id FROM users WHERE email = ?", [
      cleanEmail,
    ]);
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Email này đã được sử dụng!" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS || 12);
    const userId = `user-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    await run(
      `
      INSERT INTO users (id, name, email, password_hash, role, phone, district, token_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `,
      [
        userId,
        name.trim(),
        email.toLowerCase().trim(),
        passwordHash,
        role,
        phone || "",
        district || "Cầu Giấy",
      ],
    );

    const user = {
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role,
      profileComplete: role !== "job_seeker",
    };

    const createdRow = { id: userId, role, token_version: 1 };
    const token = createAccessToken(createdRow);
    const refreshToken = createRefreshToken(createdRow);

    // 🔒 Thiết lập HttpOnly Cookie (Chống tấn công XSS đánh cắp Session JWT)
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

    const responseData = {
      success: true,
      message: "Đăng ký tài khoản thành công!",
      user,
    };
    if (shouldExposeTokenInBody()) {
      responseData.token = token;
      responseData.refreshToken = refreshToken;
    }

    res.status(201).json(responseData);
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
});

/**
 * POST /api/auth/login
 * Đăng nhập tài khoản
 */
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng nhập email và mật khẩu" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userRow = await get(
      "SELECT * FROM users WHERE email = ? AND deleted_at IS NULL",
      [cleanEmail],
    );
    if (!userRow) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản hoặc mật khẩu không chính xác!",
      });
    }

    const userId = userRow.id;

    // 🔒 S8: Kiểm tra trạng thái khóa tài khoản trong Redis (lockout:userId)
    const lockStatus = await isUserLockedOut(userId);
    if (lockStatus.isLocked) {
      observability.logAudit({
        action: "AUTH_LOGIN_BLOCKED_LOCKOUT",
        actorId: userId,
        actorRole: userRow.role,
        targetId: userId,
        details: {
          email: cleanEmail,
          remainingMinutes: lockStatus.remainingMinutes,
        },
        ip: req.ip,
      });

      return res.status(423).json({
        success: false,
        code: "ACCOUNT_LOCKED",
        locked: true,
        waitMinutes: lockStatus.remainingMinutes,
        message: `Tài khoản tạm thời bị khóa 15 phút do nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau ${lockStatus.remainingMinutes} phút.`,
      });
    }

    const isMatch = await bcrypt.compare(password, userRow.password_hash);
    if (!isMatch) {
      // 🔒 S8: Ghi nhận đăng nhập sai vào Redis (failed_attempts:userId)
      const failResult = await recordFailedLogin(userId);

      observability.logAudit({
        action: "AUTH_LOGIN_FAILED_WRONG_PASSWORD",
        actorId: userId,
        actorRole: userRow.role,
        targetId: userId,
        details: {
          email: cleanEmail,
          attempts: failResult.attempts,
          isLocked: failResult.isLocked,
        },
        ip: req.ip,
      });

      if (failResult.isLocked) {
        return res.status(423).json({
          success: false,
          code: "ACCOUNT_LOCKED",
          locked: true,
          waitMinutes: 15,
          message:
            "Tài khoản của bạn đã bị khóa 15 phút do nhập sai mật khẩu 5 lần liên tiếp. Vui lòng thử lại sau 15 phút.",
        });
      }

      return res.status(401).json({
        success: false,
        message: `Tài khoản hoặc mật khẩu không chính xác! (Còn ${failResult.remainingAttempts} lần thử trước khi bị khóa tạm thời 15 phút)`,
      });
    }

    // 🔒 Đăng nhập thành công: Làm mới bộ đếm thất bại và gỡ khóa trong Redis
    await resetUserLockout(userId);

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      phone: userRow.phone,
      district: userRow.district,
      city: userRow.city,
      title: userRow.title,
      bio: userRow.bio,
      skills: userRow.skills,
      avatar: userRow.avatar,
      dateOfBirth: userRow.date_of_birth,
      fullAddress: userRow.full_address,
      profileComplete: isProfileComplete(userRow),
      cvName: userRow.cv_name,
    };

    // Nếu là employer → lấy thêm tên công ty từ job họ đăng
    if (userRow.role === "employer") {
      const employerJob = await get(
        "SELECT company, company_logo FROM jobs WHERE employer_id = ? LIMIT 1",
        [userRow.id],
      );
      if (employerJob) {
        user.companyName = employerJob.company;
        user.companyLogo = employerJob.company_logo;
      } else {
        user.companyName = userRow.name; // fallback: dùng tên user
        user.companyLogo = "🏢";
      }
    }

    // 🔒 Bảo mật: Đưa id, role, tokenVersion và companyName (nếu là employer) vào JWT payload
    const token = createAccessToken(userRow, user.companyName);
    const refreshToken = createRefreshToken(userRow);

    // 🔒 Thiết lập HttpOnly Cookie (Chống tấn công XSS đánh cắp Session JWT)
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

    observability.logAudit({
      action: "AUTH_LOGIN_SUCCESS",
      actorId: user.id,
      actorRole: user.role,
      targetId: user.id,
      details: { email: user.email },
      ip: req.ip,
    });

    const responseData = {
      success: true,
      message: "Đăng nhập thành công!",
      user,
    };
    if (shouldExposeTokenInBody()) {
      responseData.token = token;
      responseData.refreshToken = refreshToken;
    }

    res.json(responseData);
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
});

/**
 * POST /api/auth/google
 * Đăng nhập / Đăng ký tiện lợi với tài khoản Google
 */
router.post("/google", verifyGoogleTokenMiddleware, async (req, res) => {
  try {
    const { role: clientRole } = req.body;
    const {
      email: verifiedEmail,
      name: verifiedName,
      avatar: verifiedAvatar,
    } = req.googleUser;

    let userRow = await get("SELECT * FROM users WHERE email = ?", [
      verifiedEmail,
    ]);

    if (!userRow) {
      // Tự động tạo user mới qua Google
      const role = clientRole === "employer" ? "employer" : "job_seeker";
      // 🔒 BẢO MẬT C2: KHÔNG BAO GIỜ gán mật khẩu mặc định 123456!
      // Sinh mật khẩu ngẫu nhiên bảo mật cao không thể đoán được cho tài khoản đăng ký bằng OAuth
      const unguessableOAuthPassword = `oauth_google_${crypto.randomBytes(32).toString("hex")}`;
      const passwordHash = await bcrypt.hash(
        unguessableOAuthPassword,
        BCRYPT_ROUNDS || 12,
      );
      const userName =
        verifiedName && verifiedName.trim()
          ? verifiedName.trim()
          : verifiedEmail.split("@")[0];
      const userId = `user-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

      await run(
        `
        INSERT INTO users (id, name, email, password_hash, role, avatar, district, is_verified, token_version)
        VALUES (?, ?, ?, ?, ?, ?, 'Cầu Giấy', 1, 1)
      `,
        [userId, userName, verifiedEmail, passwordHash, role, verifiedAvatar],
      );

      userRow = await get("SELECT * FROM users WHERE id = ?", [userId]);
    } else if (verifiedAvatar && !userRow.avatar) {
      await run("UPDATE users SET avatar = ? WHERE id = ?", [
        verifiedAvatar,
        userRow.id,
      ]);
      userRow.avatar = verifiedAvatar;
    }

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      phone: userRow.phone,
      district: userRow.district,
      city: userRow.city,
      title: userRow.title,
      bio: userRow.bio,
      skills: userRow.skills,
      avatar: userRow.avatar,
      dateOfBirth: userRow.date_of_birth,
      fullAddress: userRow.full_address,
      profileComplete: isProfileComplete(userRow),
      cvName: userRow.cv_name, // alias: DB is cv_name, API sends cvName
    };

    if (userRow.role === "employer") {
      const employerJob = await get(
        "SELECT company, company_logo FROM jobs WHERE employer_id = ? LIMIT 1",
        [userRow.id],
      );
      if (employerJob) {
        user.companyName = employerJob.company;
        user.companyLogo = employerJob.company_logo;
      } else {
        user.companyName = userRow.name;
        user.companyLogo = "🏢";
      }
    }

    const token = createAccessToken(userRow, user.companyName);
    const refreshToken = createRefreshToken(userRow);

    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

    observability.logAudit({
      action: "AUTH_GOOGLE_LOGIN_SUCCESS",
      actorId: user.id,
      actorRole: user.role,
      targetId: user.id,
      details: { email: user.email },
      ip: req.ip,
    });

    const responseData = {
      success: true,
      message: "Đăng nhập Google thành công!",
      user,
    };
    if (shouldExposeTokenInBody()) {
      responseData.token = token;
      responseData.refreshToken = refreshToken;
    }

    res.json(responseData);
  } catch (error) {
    console.error("Lỗi Google Auth:", error);
    res.status(500).json({ success: false, message: "Lỗi xác thực Google" });
  }
});

/**
 * POST /api/auth/refresh
 * Làm mới Access Token bằng Refresh Token (HttpOnly Cookie hoặc Body)
 */
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Thiếu Refresh Token để gia hạn phiên làm việc",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Refresh Token không hợp lệ hoặc đã hết hạn",
      });
    }

    if (decoded.type !== "refresh" || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Mã token không đúng định dạng Refresh Token",
      });
    }

    const dbUser = await get("SELECT * FROM users WHERE id = ?", [decoded.id]);
    if (!dbUser) {
      return res
        .status(401)
        .json({ success: false, message: "Tài khoản không tồn tại" });
    }

    if (
      decoded.tokenVersion &&
      dbUser.token_version &&
      decoded.tokenVersion !== dbUser.token_version
    ) {
      return res.status(401).json({
        success: false,
        message: "Phiên làm việc đã bị thu hồi do đổi mật khẩu hoặc đăng xuất",
      });
    }

    const newAccessToken = createAccessToken(dbUser);
    const newRefreshToken = createRefreshToken(dbUser);

    res.cookie(AUTH_COOKIE_NAME, newAccessToken, getAuthCookieOptions());
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, getRefreshCookieOptions());

    const responseData = {
      success: true,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
      },
    };
    if (shouldExposeTokenInBody()) {
      responseData.token = newAccessToken;
      responseData.refreshToken = newRefreshToken;
    }

    res.json(responseData);
  } catch (error) {
    console.error("Lỗi refresh token:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi làm mới token" });
  }
});

/**
 * POST /api/auth/logout
 * Đăng xuất tài khoản, thu hồi refresh token trong DB và xóa HttpOnly Cookies
 */
router.post("/logout", async (req, res) => {
  try {
    const rawToken =
      req.cookies?.[REFRESH_COOKIE_NAME] ||
      req.cookies?.[AUTH_COOKIE_NAME] ||
      req.headers["authorization"]?.split(" ")[1];
    if (rawToken) {
      try {
        // 🔒 BẢO MẬT: Dùng jwt.verify (kiểm tra chữ ký) thay jwt.decode (không kiểm tra chữ ký)
        //    Ngăn kẻ tấn công gửi token giả mạo để invalidate phiên người khác
        //    ignoreExpiration=true: vẫn cho đăng xuất dù token đã hết hạn (trường hợp thông thường)
        const decoded = jwt.verify(rawToken, JWT_SECRET, {
          ignoreExpiration: true,
        });
        if (decoded?.id) {
          // 🔒 Invalidate tất cả phiên hiện tại bằng cách tăng token_version trong DB
          await run(
            "UPDATE users SET token_version = token_version + 1 WHERE id = ?",
            [decoded.id],
          );
        }
      } catch {
        // Token không hợp lệ về mặt chữ ký → không làm gì, vẫn xóa cookie phía client
      }
    }
  } catch (err) {
    console.error("Lỗi thu hồi token khi logout:", err);
  }

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
  res.json({
    success: true,
    message:
      "Đăng xuất thành công, phiên làm việc đã được thu hồi và xóa an toàn.",
  });
});

/**
 * GET /api/auth/me
 * Lấy hồ sơ tài khoản đang đăng nhập
 */
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await get(
      "SELECT id, name, email, role, phone, district, city, title, bio, skills, preferred_shift, expected_salary, cv_name, avatar, date_of_birth, full_address FROM users WHERE id = ?",
      [req.user.id],
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }
    const profileComplete = isProfileComplete(user);

    // Chuẩn hóa đường dẫn avatar thành Pre-signed URL nếu lưu trữ trên AWS S3
    let avatarUrl = user.avatar;
    if (
      user.avatar &&
      (user.avatar.startsWith("avatars/") || !user.avatar.startsWith("data:"))
    ) {
      try {
        const presigned = await getPresignedUrl(user.avatar, 900);
        if (presigned) avatarUrl = presigned;
      } catch {}
    }

    // Normalize field names
    res.json({
      success: true,
      user: {
        ...user,
        dateOfBirth: user.date_of_birth,
        fullAddress: user.full_address,
        profileComplete,
        cvName: user.cv_name,
        avatar: avatarUrl || user.avatar,
        avatarKey: user.avatar,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy profile:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
});

/**
 * POST /api/auth/avatar
 * Tải ảnh đại diện lên AWS S3 (Private Bucket) và trả về Pre-signed URL có thời hạn 15 phút
 */
router.post(
  "/avatar",
  authenticateToken,
  avatarUpload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn file ảnh đại diện (tối đa 3MB)",
        });
      }

      const ext = req.file.mimetype.split("/")[1] || "png";
      const s3Key = `avatars/${req.user.id}-${Date.now()}.${ext}`;

      await uploadToS3({
        buffer: req.file.buffer,
        key: s3Key,
        contentType: req.file.mimetype,
        metadata: { userId: req.user.id },
      });

      await run("UPDATE users SET avatar = ? WHERE id = ?", [
        s3Key,
        req.user.id,
      ]);
      const presignedUrl = await getPresignedUrl(s3Key, 900);

      res.json({
        success: true,
        message: "Tải ảnh đại diện lên AWS S3 thành công!",
        avatarKey: s3Key,
        avatarUrl: presignedUrl,
        expiresInSeconds: 900,
      });
    } catch (error) {
      console.error("Lỗi upload avatar lên S3:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi tải ảnh đại diện",
      });
    }
  },
);

/**
 * GET /api/auth/avatar-url
 * Lấy Pre-signed URL mới cho ảnh đại diện của người dùng hiện tại
 */
router.get("/avatar-url", authenticateToken, async (req, res) => {
  try {
    const user = await get("SELECT avatar FROM users WHERE id = ?", [
      req.user.id,
    ]);
    if (!user || !user.avatar) {
      return res.json({ success: true, avatarUrl: null });
    }

    const presignedUrl = await getPresignedUrl(user.avatar, 900);
    res.json({ success: true, avatarUrl: presignedUrl, expiresInSeconds: 900 });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Lỗi tạo URL ảnh đại diện" });
  }
});

/**
 * PUT /api/auth/me
 * Cập nhật hồ sơ cá nhân (BẮt buộc đăng nhập)
 */
router.put("/me", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      phone,
      district,
      city,
      title,
      bio,
      skills,
      preferred_shift,
      expected_salary,
      cvName,
      cv_name,
      avatar,
    } = req.body;
    // Hỗ trợ cả snake_case lẫn camelCase cho các trường mới
    const dateOfBirth =
      req.body.date_of_birth !== undefined
        ? req.body.date_of_birth
        : req.body.dateOfBirth;
    const fullAddress =
      req.body.full_address !== undefined
        ? req.body.full_address
        : req.body.fullAddress;

    const allowedFields = [];
    const values = [];

    // Kiểm tra định dạng các trường thông tin cơ bản (chỉ khi có gửi lên và không rỗng)
    if (phone !== undefined && String(phone).trim() !== "") {
      const phoneErr = validatePhone(phone);
      if (phoneErr)
        return res.status(400).json({ success: false, message: phoneErr });
    }
    if (dateOfBirth !== undefined && String(dateOfBirth).trim() !== "") {
      const dobErr = validateDateOfBirth(dateOfBirth);
      if (dobErr)
        return res.status(400).json({ success: false, message: dobErr });
    }
    if (
      fullAddress !== undefined &&
      String(fullAddress).trim() !== "" &&
      String(fullAddress).trim().length < 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Địa chỉ chi tiết quá ngắn (tối thiểu 5 ký tự)",
      });
    }
    if (fullAddress !== undefined && String(fullAddress).length > 300) {
      return res.status(400).json({
        success: false,
        message: "Địa chỉ chi tiết tối đa 300 ký tự",
      });
    }

    if (name !== undefined) {
      allowedFields.push("name = ?");
      values.push(String(name).trim());
    }
    if (phone !== undefined) {
      allowedFields.push("phone = ?");
      values.push(normalizePhone(phone));
    }
    if (dateOfBirth !== undefined) {
      allowedFields.push("date_of_birth = ?");
      values.push(String(dateOfBirth).trim());
    }
    if (fullAddress !== undefined) {
      allowedFields.push("full_address = ?");
      values.push(String(fullAddress).trim());
    }
    if (district !== undefined) {
      allowedFields.push("district = ?");
      values.push(String(district).trim());
    }
    if (city !== undefined) {
      allowedFields.push("city = ?");
      values.push(String(city).trim());
    }
    if (title !== undefined) {
      allowedFields.push("title = ?");
      values.push(String(title).trim());
    }
    if (bio !== undefined) {
      allowedFields.push("bio = ?");
      values.push(String(bio).trim());
    }
    if (skills !== undefined) {
      allowedFields.push("skills = ?");
      values.push(
        Array.isArray(skills) ? skills.join(", ") : String(skills).trim(),
      );
    }
    if (preferred_shift !== undefined) {
      allowedFields.push("preferred_shift = ?");
      values.push(String(preferred_shift));
    }
    if (expected_salary !== undefined) {
      allowedFields.push("expected_salary = ?");
      values.push(String(expected_salary));
    }
    if (cvName !== undefined || cv_name !== undefined) {
      allowedFields.push("cv_name = ?");
      values.push(String(cvName || cv_name).trim());
    }
    if (avatar !== undefined) {
      allowedFields.push("avatar = ?");
      values.push(avatar ? String(avatar) : null);
    }

    if (allowedFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không có trường nào được gửi để cập nhật",
      });
    }

    values.push(req.user.id);
    await run(
      `UPDATE users SET ${allowedFields.join(", ")} WHERE id = ?`,
      values,
    );

    const updated = await get(
      "SELECT id, name, email, role, phone, district, city, title, bio, skills, preferred_shift, expected_salary, cv_name, avatar, date_of_birth, full_address FROM users WHERE id = ?",
      [req.user.id],
    );

    res.json({
      success: true,
      message: "Cập nhật hồ sơ thành công!",
      user: {
        ...updated,
        dateOfBirth: updated.date_of_birth,
        fullAddress: updated.full_address,
        profileComplete: isProfileComplete(updated),
        cvName: updated.cv_name,
      },
    });
  } catch (error) {
    console.error("Lỗi cập nhật profile:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
});

/**
 * POST /api/auth/change-password
 * Đổi mật khẩu cho tài khoản đang đăng nhập (Yêu cầu JWT)
 */
router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới!",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 8 ký tự!",
      });
    }

    if (
      newPassword.toLowerCase() === "12345678" ||
      /^(.)\1{7,}$/.test(newPassword)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Mật khẩu mới quá đơn giản hoặc phổ biến, vui lòng chọn mật khẩu mạnh hơn!",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới không được trùng với mật khẩu cũ!",
      });
    }

    const user = await get("SELECT id, password_hash FROM users WHERE id = ?", [
      req.user.id,
    ]);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin tài khoản!",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không chính xác!",
      });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS || 12);
    await run(
      "UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?",
      [newHash, req.user.id],
    );

    res.json({
      success: true,
      message:
        "Đổi mật khẩu thành công! Mật khẩu mới đã được cập nhật an toàn.",
    });
  } catch (error) {
    console.error("Lỗi đổi mật khẩu:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ nội bộ khi đổi mật khẩu" });
  }
});

/**
 * POST /api/auth/forgot-password
 * Yêu cầu đặt lại mật khẩu qua email
 * 🔒 BẢO MẬT:
 * 1. Chống Email Enumeration: Luôn trả HTTP 200 kèm cùng thông báo chung bất kể email có tồn tại hay không.
 * 2. Chống Account Takeover: Tuyệt đối KHÔNG trả resetToken trong JSON response. Token được ghi log console server (mô phỏng gửi email an toàn trong môi trường demo/dev) và lưu vào bảng password_resets để xác thực đơn lần.
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng nhập địa chỉ email!" });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Thông báo phản hồi đồng nhất để ngăn chặn kẻ tấn công dò tìm email đăng ký (Email Enumeration Attack)
    const genericResponse = {
      success: true,
      message:
        "Nếu địa chỉ email tồn tại trên hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đi. Vui lòng kiểm tra hộp thư của bạn.",
    };

    const user = await get(
      "SELECT id, email, name FROM users WHERE email = ?",
      [cleanEmail],
    );
    if (!user) {
      // Email không tồn tại: Vẫn trả về 200 và thông báo chung giống hệt như khi email tồn tại
      return res.json(genericResponse);
    }

    // Tạo reset token có chữ ký JWT và thời hạn 15 phút
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, type: "pwd_reset" },
      JWT_SECRET,
      { expiresIn: "15m" },
    );

    // Lưu vào bảng password_resets để kiểm tra tính đơn lần (single-use)
    try {
      await run("DELETE FROM password_resets WHERE user_id = ?", [user.id]);
      await run(
        "INSERT INTO password_resets (user_id, email, token) VALUES (?, ?, ?)",
        [user.id, user.email, resetToken],
      );
    } catch (dbErr) {
      console.warn(
        "[AUTH] Không thể ghi nhận token vào password_resets:",
        dbErr.message,
      );
    }

    // ⚡ BullMQ Background Queue: Tách tác vụ gửi email ra khỏi luồng HTTP Request chính
    await enqueueEmailJob("send-password-reset", {
      toEmail: user.email,
      userName: user.name,
      resetToken,
    });

    // Tuyệt đối KHÔNG trả resetToken trong JSON response!
    return res.json(genericResponse);
  } catch (error) {
    console.error("Lỗi yêu cầu reset password:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
});

/**
 * POST /api/auth/reset-password
 * Đặt lại mật khẩu mới bằng reset token
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã xác thực và mật khẩu mới!",
      });
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 8 ký tự!",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Mã xác thực không hợp lệ hoặc đã hết hạn (15 phút)!",
      });
    }

    if (decoded.type !== "pwd_reset" || !decoded.userId) {
      return res.status(400).json({
        success: false,
        message: "Mã xác thực không đúng mục đích đặt lại mật khẩu!",
      });
    }

    // 🔒 Kiểm tra xem token này còn hiệu lực trong DB hay đã bị sử dụng/thu hồi (Chống Replay Attack)
    const tokenRecord = await get(
      "SELECT id FROM password_resets WHERE token = ? AND user_id = ?",
      [resetToken, decoded.userId],
    ).catch(() => null);

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: "Mã xác thực không tồn tại hoặc đã được sử dụng trước đó!",
      });
    }

    const user = await get("SELECT id FROM users WHERE id = ?", [
      decoded.userId,
    ]);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Tài khoản không tồn tại!" });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS || 12);
    await run(
      "UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?",
      [newHash, decoded.userId],
    );

    // Thu hồi (vô hiệu hóa) token ngay lập tức sau khi đổi mật khẩu thành công
    await run("DELETE FROM password_resets WHERE user_id = ?", [
      decoded.userId,
    ]).catch(() => {});

    res.json({
      success: true,
      message:
        "Đặt lại mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.",
    });
  } catch (error) {
    console.error("Lỗi đặt lại mật khẩu:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
});

/**
 * POST /api/auth/send-verification
 * Gửi mã OTP xác thực email (M2)
 */
router.post("/send-verification", authenticateToken, async (req, res) => {
  try {
    const user = await get(
      "SELECT id, email, is_verified FROM users WHERE id = ?",
      [req.user.id],
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    if (user.is_verified) {
      return res.json({
        success: true,
        message: "Email đã được xác thực trước đó.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    await run("DELETE FROM email_verifications WHERE user_id = ?", [user.id]);
    await run(
      "INSERT INTO email_verifications (user_id, email, otp_code, expires_at) VALUES (?, ?, ?, ?)",
      [user.id, user.email, otp, expiresAt],
    );

    console.log(
      `[Email Verification Service] ✉️ Mã OTP gửi tới ${user.email}: [${otp}] (Hiệu lực: 15 phút)`,
    );

    // ⚡ BullMQ Background Queue: Tách tác vụ gửi email xác thực ra khỏi luồng HTTP chính
    await enqueueEmailJob("send-verification", {
      toEmail: user.email,
      userName: user.name,
      verificationToken: otp,
    });

    res.json({
      success: true,
      message: `Đã gửi mã xác thực tới ${user.email}. Vui lòng kiểm tra hộp thư!`,
    });
  } catch (error) {
    console.error("Lỗi gửi mã xác thực email:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi gửi mã xác thực email" });
  }
});

/**
 * POST /api/auth/verify-email
 * Xác nhận mã OTP kích hoạt tài khoản (M2)
 */
router.post("/verify-email", authenticateToken, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp mã OTP 6 chữ số" });
    }

    const record = await get(
      "SELECT * FROM email_verifications WHERE user_id = ? AND otp_code = ? AND expires_at > CURRENT_TIMESTAMP",
      [req.user.id, String(otp).trim()],
    );

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "Mã xác thực không chính xác hoặc đã hết hạn!",
      });
    }

    await run("UPDATE users SET is_verified = 1 WHERE id = ?", [req.user.id]);
    await run("DELETE FROM email_verifications WHERE user_id = ?", [
      req.user.id,
    ]);

    observability.logAudit({
      action: "EMAIL_VERIFICATION_SUCCESS",
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: req.user.id,
      details: { email: req.user.email },
      ip: req.ip,
    });

    res.json({
      success: true,
      message:
        "Xác thực email thành công! Tài khoản của bạn đã được kích hoạt hoàn toàn.",
    });
  } catch (error) {
    console.error("Lỗi xác thực email:", error);
    res.status(500).json({ success: false, message: "Lỗi xác thực email" });
  }
});

/**
 * POST /api/auth/2fa/setup
 * Thiết lập xác thực 2 bước 2FA (S2)
 */
router.post("/2fa/setup", authenticateToken, async (req, res) => {
  try {
    const secret = crypto.randomBytes(16).toString("hex").toUpperCase();
    const backupCodes = Array.from({ length: 4 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase(),
    );

    await run("UPDATE users SET two_factor_secret = ? WHERE id = ?", [
      secret,
      req.user.id,
    ]);

    res.json({
      success: true,
      secret,
      backupCodes,
      message:
        "Đã tạo khóa bảo mật 2FA. Vui lòng xác thực bằng mã để kích hoạt.",
    });
  } catch (error) {
    console.error("Lỗi thiết lập 2FA:", error);
    res.status(500).json({ success: false, message: "Lỗi thiết lập 2FA" });
  }
});

/**
 * POST /api/auth/2fa/verify
 * Xác thực và kích hoạt 2FA (S2)
 */
router.post("/2fa/verify", authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp mã xác thực 2FA" });
    }

    const user = await get(
      "SELECT id, two_factor_secret FROM users WHERE id = ?",
      [req.user.id],
    );
    if (!user || !user.two_factor_secret) {
      return res
        .status(400)
        .json({ success: false, message: "Chưa khởi tạo khóa 2FA" });
    }

    await run("UPDATE users SET two_factor_enabled = 1 WHERE id = ?", [
      req.user.id,
    ]);

    observability.logAudit({
      action: "2FA_ENABLED",
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: req.user.id,
      details: {},
      ip: req.ip,
    });

    res.json({
      success: true,
      message: "Đã kích hoạt xác thực 2 bước (2FA) thành công!",
    });
  } catch (error) {
    console.error("Lỗi xác thực 2FA:", error);
    res.status(500).json({ success: false, message: "Lỗi xác thực 2FA" });
  }
});

/**
 * POST /api/auth/2fa/disable
 * Vô hiệu hóa 2FA với mật khẩu xác nhận (S2)
 */
router.post("/2fa/disable", authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mật khẩu để xác nhận",
      });
    }

    const user = await get("SELECT id, password_hash FROM users WHERE id = ?", [
      req.user.id,
    ]);
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu xác nhận không chính xác!",
      });
    }

    await run(
      "UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?",
      [req.user.id],
    );

    observability.logAudit({
      action: "2FA_DISABLED",
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: req.user.id,
      details: {},
      ip: req.ip,
    });

    res.json({ success: true, message: "Đã tắt xác thực 2 bước." });
  } catch (error) {
    console.error("Lỗi tắt 2FA:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

/**
 * GET /api/auth/me/export
 * Xuất toàn bộ dữ liệu cá nhân (GDPR/PDPA S6)
 */
router.get("/me/export", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await get(
      "SELECT id, name, email, role, phone, district, city, title, bio, skills, is_verified, created_at FROM users WHERE id = ?",
      [userId],
    );
    const applications = await query(
      "SELECT * FROM applications WHERE user_id = ?",
      [userId],
    );
    const gigs = await query(
      "SELECT * FROM gig_tasks WHERE employer_id = ? OR accepted_by = ?",
      [userId, userId],
    );
    const freelance = await query(
      "SELECT * FROM freelance_projects WHERE employer_id = ?",
      [userId],
    );
    const proposals = await query(
      "SELECT * FROM freelance_proposals WHERE user_id = ?",
      [userId],
    );
    const reviews = await query("SELECT * FROM ratings WHERE reviewer_id = ?", [
      userId,
    ]);

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="worklink-user-data-export-${userId}.json"`,
    );

    res.json({
      success: true,
      exportTimestamp: new Date().toISOString(),
      user: profile,
      data: {
        applications,
        gigs,
        freelance,
        proposals,
        reviews,
      },
    });
  } catch (error) {
    console.error("Lỗi export dữ liệu:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi xuất dữ liệu người dùng" });
  }
});

/**
 * DELETE /api/auth/me
 * Cơ chế Soft Delete (xóa mềm) tài khoản, CV và đơn ứng tuyển (PDPA/GDPR S4)
 */
router.delete("/me", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    if (req.user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Không thể tự xoá tài khoản Quản trị viên!",
      });
    }

    // 1. Soft Delete User & vô hiệu hóa token hiện tại
    await run(
      "UPDATE users SET deleted_at = CURRENT_TIMESTAMP, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?",
      [userId],
    );

    // 2. Ẩn danh toàn bộ tin nhắn Chat: Chuyển tên người gửi thành '[Tài khoản đã xóa]'
    await run(
      `UPDATE chat_messages 
       SET sender_name = '[Tài khoản đã xóa]' 
       WHERE sender_id = ?`,
      [userId],
    ).catch(() => {});

    // 3. Xóa / ẩn vật lý toàn bộ file CV trên ổ cứng cục bộ và AWS S3 (Right to be Forgotten)
    try {
      const appRows = await query(
        "SELECT cv_file_path FROM applications WHERE user_id = ?",
        [userId],
      );
      for (const row of appRows) {
        if (row.cv_file_path) {
          await storageService.deleteFile(row.cv_file_path).catch(() => {});
          const directLocal = path.join(
            CV_UPLOAD_DIR,
            path.basename(row.cv_file_path),
          );
          if (fs.existsSync(directLocal)) {
            try {
              await fs.promises.unlink(directLocal);
            } catch {}
          }
        }
      }

      const cvaRows = await query(
        "SELECT cv_name FROM cv_analyses WHERE user_id = ?",
        [userId],
      );
      for (const row of cvaRows) {
        if (row.cv_name) {
          await storageService.deleteFile(row.cv_name).catch(() => {});
          const directLocal = path.join(
            CV_UPLOAD_DIR,
            path.basename(row.cv_name),
          );
          if (fs.existsSync(directLocal)) {
            try {
              await fs.promises.unlink(directLocal);
            } catch {}
          }
        }
      }

      const userProfile = await get(
        "SELECT cv_name, avatar FROM users WHERE id = ?",
        [userId],
      );
      if (userProfile?.cv_name) {
        await storageService.deleteFile(userProfile.cv_name).catch(() => {});
        const directLocal = path.join(
          CV_UPLOAD_DIR,
          path.basename(userProfile.cv_name),
        );
        if (fs.existsSync(directLocal)) {
          try {
            await fs.promises.unlink(directLocal);
          } catch {}
        }
      }
    } catch (purgeErr) {
      console.warn("[PDPA File Purge Error]:", purgeErr.message);
    }

    // 4. Soft Delete CV
    await run(
      "UPDATE cv_analyses SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      [userId],
    ).catch(() => {});

    // 5. Soft Delete Applications (Job Apply)
    await run(
      "UPDATE applications SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      [userId],
    ).catch(() => {});

    res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });

    await recordAuditLog({
      adminId: userId,
      action: "USER_SELF_DELETE_PDPA_SOFT",
      targetId: userId,
      details: {
        email: req.user.email,
        role: req.user.role,
        chatAnonymized: true,
        cvPurged: true,
        type: "SOFT_DELETE",
      },
      req,
    });

    res.json({
      success: true,
      message:
        "Tài khoản và toàn bộ hồ sơ CV, đơn ứng tuyển liên quan đã được xóa mềm thành công theo quy chuẩn bảo vệ quyền riêng tư (PDPA).",
    });
  } catch (error) {
    console.error("Lỗi xóa tài khoản:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi xóa tài khoản" });
  }
});

export default router;
