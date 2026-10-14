// ⚠️ dotenv PHẢI được load đầu tiên, trước khi bất kỳ module nào đọc process.env
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/authRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import freelanceRoutes from "./routes/freelanceRoutes.js";
import gigRoutes from "./routes/gigRoutes.js";
import ratingRoutes from "./routes/ratingRoutes.js";
import notificationRoutes, {
  createNotification,
} from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import cvRoutes from "./routes/cvRoutes.js";
import externalJobRoutes from "./routes/externalJobRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { run, get, dbReady } from "./db.js";
import {
  canUserAccessThread,
  getThreadRecipient,
} from "./services/chatSecurity.js";
import { generalLimiter } from "./middleware/rateLimiter.js";
import { observability } from "./services/observability.js";
import { csrfProtection, getCsrfTokenHandler } from "./middleware/csrf.js";
import { sentryErrorHandler } from "./services/sentry.js";
import { setupSocketIORedisAdapter } from "./config/redis.js";
import { startJobExpirationCron } from "./services/jobExpirationCron.js";
import { startAiQuotaCron } from "./services/aiQuotaCron.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "worklink-super-secret-key-2026";
const isProduction = process.env.NODE_ENV === "production";

// Helper logging: Chỉ log chi tiết chat/debug khi ở môi trường dev hoặc bật DEBUG=true
const debugLog = (...args) => {
  if (!isProduction || process.env.DEBUG === "true") {
    console.log(...args);
  }
};

const INSECURE_DEFAULT_SECRETS = [
  "worklink-super-secret-key-2026",
  "worklink-super-secure-production-key-2026",
  "your-super-secret-jwt-key-change-this-in-production-min-32-chars",
];

if (
  isProduction &&
  (!process.env.JWT_SECRET ||
    INSECURE_DEFAULT_SECRETS.includes(process.env.JWT_SECRET) ||
    process.env.JWT_SECRET.length < 32)
) {
  console.error(
    "❌ [BẢO MẬT BẮT BUỘC] Không thể khởi động trên Production với JWT_SECRET mặc định hoặc không an toàn (< 32 ký tự)! Vui lòng cấu hình JWT_SECRET an toàn trong biến môi trường.",
  );
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// 🔒 Trust Proxy: Bắt buộc khi deploy sau Reverse Proxy (Render, Railway, Vercel, Fly.io, Nginx)
// Cho phép Express và express-rate-limit đọc đúng IP thật của client qua X-Forwarded-For thay vì IP proxy.
app.set("trust proxy", 1);

// 🔒 Force HTTPS Redirect on Production (H6)
if (isProduction) {
  app.use((req, res, next) => {
    const proto = req.headers["x-forwarded-proto"];
    if (proto && proto !== "https") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// 📡 Centralized Observability & Tracing (X-Request-Id, Latency & Audit Logging)
app.use(observability.requestTracingMiddleware());

// 🔒 Security Headers với Helmet (Chống clickjacking, MIME sniffing, XSS, Content Security Policy)
// Loại bỏ hoàn toàn 'unsafe-inline' cho scriptSrc theo chuẩn OWASP & Production Hardening
const enableCSP = isProduction || process.env.ENABLE_CSP === "true";
app.use(
  helmet({
    strictTransportSecurity: isProduction
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    contentSecurityPolicy: enableCSP
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://accounts.google.com"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
              "https://unpkg.com",
              "https://accounts.google.com",
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
            connectSrc: ["'self'", "ws:", "wss:", "https:", "http:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "data:", "blob:"],
            frameSrc: ["'self'", "https://accounts.google.com"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        }
      : false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS Allowlist tĩnh (dùng khi không có tunnel)
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5174",
        "http://localhost:4173",
      ]
).map((s) => s.trim().toLowerCase());

/**
 * CORS Delegate — hỗ trợ tunnel động (ngrok, Cloudflare Tunnel)
 *
 * Logic:
 * 1. Không có origin → cho phép (server-to-server, health check)
 * 2. Origin trong allowlist tĩnh → cho phép
 * 3. localhost/127.0.0.1 ở môi trường dev → cho phép
 * 4. Tunnel mode: nếu origin khớp với x-forwarded-host hoặc host header → cho phép
 *    (khi chạy qua ngrok/Cloudflare, cả frontend lẫn backend cùng host)
 */
const corsOriginChecker = (origin, cb, req) => {
  // 1. Không có origin — cho phép (mobile app, curl, health probe)
  if (!origin) {
    if (isProduction && process.env.STRICT_CORS === "true") {
      return cb(
        new Error(
          "CORS: Missing Origin header is not allowed in strict production mode",
        ),
      );
    }
    return cb(null, true);
  }

  const normalizedOrigin = origin.toLowerCase().trim();

  // 2. Origin trong allowlist tĩnh
  if (allowedOrigins.includes(normalizedOrigin)) {
    return cb(null, true);
  }

  // 3. Dev: localhost / 127.0.0.1 với port bất kỳ
  if (
    !isProduction &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]{1,5})?$/.test(normalizedOrigin)
  ) {
    return cb(null, true);
  }

  // 4. Tunnel mode: so sánh host của origin với x-forwarded-host hoặc host header
  //    Khi chạy qua ngrok/Cloudflare, cả FE và BE cùng một domain → same-origin
  if (req) {
    try {
      const originHost = new URL(normalizedOrigin).hostname;
      const forwardedHost = (req.headers["x-forwarded-host"] || "")
        .split(",")[0]
        .trim()
        .toLowerCase();
      const serverHost = (req.headers["host"] || "")
        .split(":")[0]
        .trim()
        .toLowerCase();
      if (
        originHost &&
        (originHost === forwardedHost || originHost === serverHost)
      ) {
        return cb(null, true);
      }
    } catch {
      // URL parse fail → tiếp tục xuống block từ chối
    }
  }

  return cb(new Error(`CORS: origin ${origin} not allowed`));
};

// Wrapper tương thích cors() middleware: cors() gọi với (origin_string, callback)
// Không thể truy cập req tại đây — không cần vì tunnel là same-origin (FE+BE cùng port 5000)
const corsDelegate = (origin, cb) => {
  corsOriginChecker(origin, cb, null);
};

// Socket.io server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, cb) => corsOriginChecker(origin, cb, null),
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

// 🚀 Scale đa Instance: Đồng bộ hóa sự kiện Socket.io qua Redis Adapter
setupSocketIORedisAdapter(io);

app.use(
  cors({
    origin: corsDelegate,
    credentials: true,
  }),
);

// 🍪 Cookie Parser Middleware (Giải mã HttpOnly Cookies bảo vệ session - M7)
app.use(cookieParser());

// 🛡️ CSRF Protection Middleware (S8 - Bảo vệ các request sử dụng HttpOnly Cookie)
app.use(csrfProtection);

// 🔑 Endpoint cấp phát CSRF token cho Frontend React SPA
app.get("/api/csrf-token", csrfProtection, getCsrfTokenHandler);

// 🔒 Parser 15MB riêng cho route CV để xử lý base64 PDF (phải mount TRƯỚC parser 1MB chung)
app.use(
  "/api/cv",
  express.json({ limit: "15mb" }),
  express.urlencoded({ extended: true, limit: "15mb" }),
  cvRoutes,
);
app.use(
  "/api/ai/analyze-cv",
  express.json({ limit: "15mb" }),
  express.urlencoded({ extended: true, limit: "15mb" }),
  (req, res, next) => {
    req.url = "/analyze";
    cvRoutes(req, res, next);
  },
);

// 🔒 Giới hạn body parser mặc định 1MB cho API chung chống DoS
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 🛡️ Áp dụng General Rate Limiter cho toàn bộ các endpoint /api
app.use("/api", generalLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/freelance", freelanceRoutes);
app.use("/api/gigs", gigRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ai", aiRoutes);
// Note: /api/cv đã được mount ở trên với giới hạn 15MB
app.use("/api/external-jobs", externalJobRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/users", userRoutes);

// Health Check Endpoint (Kiểm tra trạng thái máy chủ, CSDL PostgreSQL, dung lượng bộ nhớ, và thư mục lưu trữ uploads)
app.get("/api/health", async (req, res) => {
  let dbStatus = "connected";
  let dbLatencyMs = null;
  try {
    const start = Date.now();
    await get("SELECT 1");
    dbLatencyMs = Date.now() - start;
  } catch (err) {
    dbStatus = "disconnected";
  }

  let storageStatus = "writable";
  try {
    const uploadsDir = path.resolve(__dirname, "..", "uploads");
    if (!fs.existsSync(uploadsDir))
      fs.mkdirSync(uploadsDir, { recursive: true });
    const probeFile = path.join(uploadsDir, ".health_probe");
    fs.writeFileSync(probeFile, "ok");
    fs.unlinkSync(probeFile);
  } catch {
    storageStatus = "readonly_or_unavailable";
  }

  const memUsage = process.memoryUsage();
  const isHealthy = dbStatus === "connected";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "online" : "degraded",
    database: dbStatus,
    dbLatencyMs,
    storage: {
      uploads: storageStatus,
    },
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: Math.round(memUsage.rss / 1024 / 1024),
      nodeVersion: process.version,
    },
    platform: "WorkLink API Server",
    version: "2.0.0",
    realtime: "Socket.io enabled",
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// SOCKET.IO — REAL-TIME CHAT (với xác thực JWT & DB Re-check)
// ============================================

/**
 * Middleware xác thực JWT cho Socket.io (kiểm tra lại quyền & token_version từ DB)
 * Client gửi token qua: io({ auth: { token: '...' } })
 */
io.use(async (socket, next) => {
  let token = socket.handshake.auth?.token;
  if (!token && socket.handshake.headers?.cookie) {
    const rawCookies = socket.handshake.headers.cookie.split(";");
    for (const cookieStr of rawCookies) {
      const [k, v] = cookieStr.trim().split("=");
      if (k === "worklink_jwt_token") {
        token = decodeURIComponent(v);
        break;
      }
    }
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.id) {
        // Lấy name, role, token_version từ DB để xác minh token hợp lệ (bảng users KHÔNG có company_name)
        const dbUser = await get(
          "SELECT id, name, role, token_version FROM users WHERE id = $1",
          [decoded.id],
        );
        if (
          dbUser &&
          (!decoded.tokenVersion ||
            !dbUser.token_version ||
            decoded.tokenVersion === dbUser.token_version)
        ) {
          socket.user = {
            ...decoded,
            name: dbUser.name || decoded.name || "Người dùng",
            role: dbUser.role,
          };
        } else {
          socket.user = null;
        }
      } else {
        socket.user = null;
      }
    } catch {
      socket.user = null;
    }
  } else {
    socket.user = null;
  }
  next();
});

io.on("connection", (socket) => {
  debugLog(
    `[Chat] Client connected: ${socket.id} | user: ${socket.user?.id || "anonymous"}`,
  );

  // Client tham gia vào phòng chat theo threadId (bọc try-catch và validate an toàn)
  socket.on("join_thread", async (data) => {
    try {
      if (!socket.user) {
        return socket.emit("error", {
          message: "Bạn chưa đăng nhập. Vui lòng đăng nhập để chat.",
        });
      }
      if (!data || typeof data !== "object") return;
      const { threadId } = data;
      if (!threadId || typeof threadId !== "string") return;

      // Kiểm tra quyền sở hữu / tham gia thread
      const hasAccess = await canUserAccessThread(
        socket.user.id,
        socket.user.role,
        threadId,
      );
      if (!hasAccess) {
        return socket.emit("error", {
          message:
            "Từ chối quyền: Bạn không có quyền truy cập cuộc hội thoại này.",
        });
      }
      socket.join(threadId);
      debugLog(
        `[Chat] ${socket.user.id} (${socket.user.name}) joined thread: ${threadId}`,
      );
    } catch (err) {
      console.error("[Socket.io] join_thread error:", err);
    }
  });

  // Client gửi tin nhắn — identity luôn lấy từ JWT và DB, không tin client
  socket.on("send_message", async (data) => {
    try {
      if (!socket.user) {
        return socket.emit("error", {
          message: "Bạn chưa đăng nhập. Vui lòng đăng nhập để gửi tin nhắn.",
        });
      }
      if (!data || typeof data !== "object") return;

      const { threadId, text } = data;
      if (
        !threadId ||
        typeof threadId !== "string" ||
        !text ||
        typeof text !== "string" ||
        !text.trim()
      )
        return;

      // Kiểm tra quyền gửi tin nhắn vào thread
      const hasAccess = await canUserAccessThread(
        socket.user.id,
        socket.user.role,
        threadId,
      );
      if (!hasAccess) {
        return socket.emit("error", {
          message:
            "Từ chối quyền: Bạn không có quyền gửi tin nhắn vào cuộc hội thoại này.",
        });
      }

      // Lấy từ user đã xác thực, luôn đảm bảo senderName không bao giờ rỗng để thỏa mãn ràng buộc NOT NULL
      const senderId = socket.user.id;
      const senderName =
        socket.user.name || socket.user.companyName || "Người dùng";
      const senderRole = socket.user.role || "job_seeker";

      const msgId = `msg-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      const createdAt = new Date().toISOString();

      // Lưu vào DB
      await run(
        `INSERT INTO chat_messages (id, thread_id, sender_id, sender_name, sender_role, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          msgId,
          threadId,
          senderId,
          senderName,
          senderRole,
          text.trim(),
          createdAt,
        ],
      );

      const message = {
        id: msgId,
        threadId,
        senderId,
        senderName,
        senderRole,
        text: text.trim(),
        createdAt,
      };

      // Broadcast tới TẤT CẢ client trong room (gồm cả người gửi)
      io.to(threadId).emit("new_message", message);

      // Gửi thông báo chuông cho người nhận trong cuộc hội thoại
      try {
        const recipientId = await getThreadRecipient(senderId, threadId);
        if (recipientId && recipientId !== senderId) {
          await createNotification({
            userId: recipientId,
            type: "message",
            title: `Tin nhắn mới từ ${senderName}`,
            body: text.trim().slice(0, 100),
            linkType: "chat",
            linkId: threadId,
          });
        }
      } catch (notifErr) {
        console.warn(
          "[Socket.io] Lỗi tạo thông báo tin nhắn:",
          notifErr.message,
        );
      }

      debugLog(
        `[Chat] Message in ${threadId}: [${senderName}] ${text.trim().slice(0, 40)}`,
      );
    } catch (err) {
      console.error("[Chat] Save message error:", err);
      socket.emit("error", { message: "Lỗi gửi tin nhắn" });
    }
  });

  // Client thông báo đang gõ — kiểm tra quyền và phòng đã join
  socket.on("typing", (data) => {
    try {
      if (!socket.user || !data || typeof data !== "object") return;
      const { threadId } = data;
      if (!threadId || typeof threadId !== "string") return;
      if (!socket.rooms.has(threadId)) return;
      socket
        .to(threadId)
        .emit("typing", { senderName: socket.user.name || "Người dùng" });
    } catch (err) {
      console.error("[Socket.io] typing error:", err);
    }
  });

  socket.on("stop_typing", (data) => {
    try {
      if (!socket.user || !data || typeof data !== "object") return;
      const { threadId } = data;
      if (!threadId || typeof threadId !== "string") return;
      if (!socket.rooms.has(threadId)) return;
      socket.to(threadId).emit("stop_typing");
    } catch (err) {
      console.error("[Socket.io] stop_typing error:", err);
    }
  });

  socket.on("disconnect", () => {
    debugLog(`[Chat] Client disconnected: ${socket.id}`);
  });
});

// Phục vụ Frontend Static Files nếu thư mục dist/ tồn tại (hỗ trợ triển khai Docker Container Fullstack all-in-one)
const distPath = path.resolve(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  console.log(`[Static] Phục vụ Frontend Static Files từ: ${distPath}`);
  app.use(express.static(distPath));

  // SPA Fallback cho các router phía client (chỉ áp dụng cho các route GET không thuộc /api hay /socket.io)
  app.use((req, res, next) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api") &&
      !req.path.startsWith("/socket.io")
    ) {
      return res.sendFile(path.join(distPath, "index.html"));
    }
    next();
  });
}

// Graceful Error Handling Middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res
      .status(400)
      .json({ success: false, message: "Dữ liệu JSON gửi lên không hợp lệ" });
  }
  if (err.message?.startsWith("CORS:")) {
    return res.status(403).json({ success: false, message: err.message });
  }
  next(err);
});

// 📡 Sentry Error Handler Middleware (@sentry/node - Gửi ngoại lệ có context lên Sentry khi có SENTRY_DSN)
app.use(sentryErrorHandler);

// 📡 Observability Centralized Error Handler (Sentry + Structured Telemetry Logger)
app.use(observability.errorHandlerMiddleware());

async function startServer() {
  try {
    await dbReady;
    httpServer.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `❌ [SERVER] Cổng ${PORT} đang được sử dụng hoặc đang trong trạng thái giải phóng (TIME_WAIT). Vui lòng thử lại sau vài giây!`,
        );
      } else {
        console.error("❌ [SERVER] Lỗi máy chủ HTTP:", err);
      }
    });

    httpServer.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🚀 WORKLINK BACKEND + SOCKET.IO RUNNING!`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`💬 Real-time chat: Socket.io enabled`);
      console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
      console.log(`=========================================`);

      // 🕒 Kích hoạt Cron Job tự động ẩn tin tuyển dụng quá hạn (chạy lúc 0:00 hàng ngày)
      startJobExpirationCron();

      // 🕒 Kích hoạt Cron Job tự động reset AI Quota về 5 vào ngày 1 hàng tháng
      startAiQuotaCron();
    });
  } catch (err) {
    console.error("Lỗi khởi động máy chủ:", err);
  }
}

startServer();
