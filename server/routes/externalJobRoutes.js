/**
 * External Jobs Routes — Kéo tin từ các sàn tuyển dụng bên ngoài
 * GET  /api/external-jobs          — danh sách tin tổng hợp
 * GET  /api/external-jobs/sources  — danh sách nguồn
 * POST /api/external-jobs/sync     — Admin force sync cache
 */
import express from 'express';
import { fetchExternalJobs, getExternalSources, clearAggregatorCache } from '../services/jobAggregator.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/external-jobs
 * Query params: q (keyword), location, category, page, limit
 */
router.get('/', async (req, res) => {
  try {
    const { q = '', location = '', category = '', page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const jobs = await fetchExternalJobs({ keyword: q, location, category });

    const start = (pageNum - 1) * limitNum;
    const paginated = jobs.slice(start, start + limitNum);

    res.json({
      success: true,
      total: jobs.length,
      page: pageNum,
      limit: limitNum,
      jobs: paginated
    });
  } catch (err) {
    console.error('[External Jobs Error]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi tổng hợp tin tuyển dụng', error: err.message });
  }
});

/**
 * GET /api/external-jobs/sources
 * Trả về danh sách các sàn đang kết nối
 */
router.get('/sources', (_req, res) => {
  res.json({ success: true, sources: getExternalSources() });
});

/**
 * POST /api/external-jobs/sync
 * Admin: xóa cache và fetch lại ngay
 */
router.post('/sync', authenticateToken, requireAdmin, async (req, res) => {
  clearAggregatorCache();
  try {
    const jobs = await fetchExternalJobs();
    res.json({ success: true, message: `Đã đồng bộ ${jobs.length} tin từ các sàn`, total: jobs.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
