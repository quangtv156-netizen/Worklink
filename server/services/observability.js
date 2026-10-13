import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';
const SENTRY_DSN = process.env.SENTRY_DSN || null;

/**
 * Hệ thống Observability & Giám sát lỗi trung tâm (Centralized Observability Service)
 * Hỗ trợ tích hợp Sentry (nếu có SENTRY_DSN) và hệ thống Structured Telemetry Logger chuẩn Production.
 */
class ObservabilityService {
  constructor() {
    this.sentryEnabled = Boolean(SENTRY_DSN);
    this.init();
  }

  init() {
    if (this.sentryEnabled) {
      console.log(`[Observability] 📡 Sentry DSN phát hiện: Kích hoạt giám sát lỗi thời gian thực`);
    } else {
      console.log(`[Observability] 📊 Structured Telemetry Logger khởi tạo (Chế độ tự động ghi log lỗi có ngữ cảnh)`);
    }

    // Bắt các ngoại lệ không lường trước trên tiến trình Node.js (Uncaught Exception & Unhandled Rejection)
    process.on('uncaughtException', (err) => {
      this.captureException(err, { source: 'process.uncaughtException', fatal: true });
      if (isProduction) {
        // Cho phép gửi telemetry trước khi thoát
        setTimeout(() => process.exit(1), 1000);
      }
    });

    process.on('unhandledRejection', (reason) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      this.captureException(err, { source: 'process.unhandledRejection' });
    });
  }

  /**
   * Báo cáo và ghi log lỗi có ngữ cảnh chi tiết (Contextual Error Capture)
   */
  captureException(error, context = {}) {
    const errorPayload = {
      timestamp: new Date().toISOString(),
      level: context.fatal ? 'fatal' : 'error',
      message: error?.message || String(error),
      name: error?.name || 'Error',
      stack: error?.stack || null,
      context: {
        ...context,
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    };

    if (isProduction) {
      // Structured JSON format cho Cloud Logging (Render, Datadog, CloudWatch, Papertrail)
      console.error(JSON.stringify(errorPayload));
    } else {
      console.error(`[Observability Error] ${errorPayload.timestamp} [${context.requestId || 'no-req'}] ${errorPayload.message}`);
      if (error?.stack) console.error(error.stack);
    }

    // Gửi tới Sentry qua HTTP REST API nếu SENTRY_DSN được cấu hình mà không bắt buộc cài gói nặng
    if (this.sentryEnabled && SENTRY_DSN) {
      this.sendToSentry(errorPayload).catch(() => {});
    }
  }

  /**
   * Ghi log kiểm toán bảo mật (Audit Logging: Auth, Role change, User deletion, Boost job, CV download)
   */
  logAudit(auditEvent) {
    const payload = {
      type: 'audit_log',
      timestamp: new Date().toISOString(),
      action: auditEvent.action,
      actorId: auditEvent.actorId || 'system',
      actorRole: auditEvent.actorRole || null,
      targetId: auditEvent.targetId || null,
      details: auditEvent.details || {},
      ip: auditEvent.ip || null
    };

    if (isProduction) {
      console.log(JSON.stringify(payload));
    } else {
      console.log(`[AUDIT] ${payload.timestamp} [${payload.action}] Actor: ${payload.actorId} (${payload.actorRole || 'n/a'}) -> Target: ${payload.targetId || 'n/a'}`);
    }
  }

  /**
   * Gửi sự kiện lỗi tới Sentry qua Ingest API (Zero extra heavy dependencies)
   */
  async sendToSentry(payload) {
    try {
      // Parse DSN: https://<key>@<host>/<projectId>
      const match = SENTRY_DSN.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
      if (!match) return;
      const [, publicKey, host, projectId] = match;
      const sentryUrl = `https://${host}/api/${projectId}/store/`;

      await fetch(sentryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=worklink-agent/1.0, sentry_key=${publicKey}`
        },
        body: JSON.stringify({
          event_id: crypto.randomBytes(16).toString('hex'),
          timestamp: payload.timestamp,
          level: payload.level,
          platform: 'node',
          message: payload.message,
          exception: {
            values: [{
              type: payload.name,
              value: payload.message,
              stacktrace: { frames: [] }
            }]
          },
          extra: payload.context
        })
      });
    } catch {
      // Fail-safe: Không bao giờ làm crash server khi gửi telemetry thất bại
    }
  }

  /**
   * Middleware gắn Request ID và đo thời gian xử lý (Latency Tracing)
   */
  requestTracingMiddleware() {
    return (req, res, next) => {
      const incomingId = req.headers['x-request-id'];
      req.id = incomingId && typeof incomingId === 'string'
        ? incomingId.slice(0, 64)
        : `req_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

      res.setHeader('X-Request-Id', req.id);
      const startTime = Date.now();

      res.on('finish', () => {
        const durationMs = Date.now() - startTime;
        // Chỉ log chi tiết các request có thời gian xử lý chậm (>500ms) hoặc mã lỗi >= 400
        if (res.statusCode >= 400 || durationMs > 500 || (!isProduction && process.env.DEBUG === 'true')) {
          const logData = {
            type: 'http_request',
            requestId: req.id,
            method: req.method,
            path: req.originalUrl || req.path,
            status: res.statusCode,
            durationMs,
            userId: req.user?.id || null,
            userRole: req.user?.role || null,
            ip: req.ip || req.headers['x-forwarded-for'] || null
          };

          if (res.statusCode >= 500) {
            console.error(`[HTTP 5xx] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${durationMs}ms) ID: ${req.id}`);
          } else if (durationMs > 1000) {
            console.warn(`[SLOW REQ] ${req.method} ${req.originalUrl} (${durationMs}ms) ID: ${req.id}`);
          }
        }
      });

      next();
    };
  }

  /**
   * Middleware bắt và ghi nhận lỗi Express 5xx
   */
  errorHandlerMiddleware() {
    return (err, req, res, next) => {
      if (res.headersSent) {
        return next(err);
      }

      this.captureException(err, {
        source: 'express.errorHandler',
        requestId: req.id,
        method: req.method,
        path: req.originalUrl || req.path,
        userId: req.user?.id || null
      });

      const statusCode = err.status || err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: isProduction && statusCode === 500
          ? 'Đã xảy ra sự cố nội bộ máy chủ. Đội ngũ kỹ thuật đã được thông báo để xử lý.'
          : err.message || 'Lỗi máy chủ',
        requestId: req.id
      });
    };
  }
}

export const observability = new ObservabilityService();
