import express from 'express';
import { processCopilotMessage } from '../services/ragService.js';
import { query } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * POST /api/ai/copilot
 * Process user questions with RAG Database Grounding + Dual AI Engine
 * 🛡️ Bảo vệ: aiLimiter giới hạn tần suất gọi AI chống cạn kiệt quota Gemini
 */
router.post('/copilot', aiLimiter, optionalAuth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Trường message là bắt buộc'
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung câu hỏi quá dài (tối đa 2.000 ký tự)'
      });
    }

    const safeHistory = Array.isArray(history) ? history.slice(-20) : [];

    // 🔒 Bảo mật: Chỉ dùng identity từ JWT đã được xác thực (req.user),
    // Tuyệt đối không tin tưởng userId gửi từ body client để ngăn chặn đọc trộm hồ sơ người khác.
    const userContext = req.user ? {
      userId: req.user.id,
      email: req.user.email || null,
      name: req.user.name || null,
      role: req.user.role || 'job_seeker'
    } : null;

    // 🔒 Bảo mật: Chỉ sử dụng GEMINI_API_KEY cấu hình trên máy chủ, không nhận API key từ phía client
    const result = await processCopilotMessage(message.trim(), safeHistory, null, userContext);

    return res.json({
      success: true,
      text: result.text,
      jobs: result.jobs || [],
      source: result.source || 'WorkLink RAG Engine 🧠',
      suggestedPrompts: result.suggestedPrompts || [],
      fallbackNotice: result.fallbackNotice || null
    });
  } catch (err) {
    console.error('[AI Router Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý hội thoại RAG AI',
      error: err.message
    });
  }
});

/**
 * GET /api/ai/config
 * Exposes server AI capability without leaking API keys
 */
router.get('/config', (req, res) => {
  const hasServerKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10);
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  res.json({
    success: true,
    hasServerKey,
    model,
    ragEnabled: true
  });
});

/**
 * GET /api/ai/stats
 * Quick database stats for AI context overview
 */
router.get('/stats', async (req, res) => {
  try {
    const jobsCount = await query('SELECT COUNT(*) as count FROM jobs');
    const categories = await query('SELECT category, COUNT(*) as count FROM jobs GROUP BY category');
    const topCompanies = await query('SELECT DISTINCT company, district FROM jobs LIMIT 6');

    return res.json({
      success: true,
      totalJobs: jobsCount[0]?.count || 0,
      categories,
      topCompanies
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
