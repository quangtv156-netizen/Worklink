import express from 'express';
import crypto from 'crypto';
import { query, get, run } from '../db.js';
import { authenticateToken, requireEmployerOrAdmin } from '../middleware/auth.js';
import { filterAndRankJobs } from '../../shared/services/aiSearchService.js';
import { observability } from '../services/observability.js';
import { cacheService } from '../services/cacheService.js';
import { cacheJobsMiddleware, invalidateJobsCache } from '../config/redis.js';
import { autoExpireOutdatedJobs } from '../services/jobExpirationCron.js';

const router = express.Router();

function formatJobRow(row) {
  if (!row) return null;
  let reqs = [];
  let bens = [];
  try {
    reqs = typeof row.requirements === 'string' && row.requirements.startsWith('[') 
      ? JSON.parse(row.requirements) 
      : (row.requirements ? row.requirements.split(',').map(s => s.trim()) : []);
  } catch (e) { reqs = []; }

  try {
    bens = typeof row.benefits === 'string' && row.benefits.startsWith('[')
      ? JSON.parse(row.benefits)
      : (row.benefits ? row.benefits.split(',').map(s => s.trim()) : []);
  } catch (e) { bens = []; }

  return {
    id: row.id,
    employerId: row.employer_id,
    title: row.title,
    company: row.company,
    companyLogo: row.company_logo || '💼',
    category: row.category,
    district: row.district,
    city: row.city,
    address: row.address,
    salaryDisplay: row.salary_display,
    salaryType: row.salary_type,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    jobType: row.job_type,
    timeShift: row.time_shift,
    timeHours: row.time_hours,
    experience: row.experience,
    description: row.description,
    requirements: reqs,
    benefits: bens,
    slots: row.slots,
    deadline: row.deadline,
    hashtags: row.hashtags ? row.hashtags.split(' ').filter(Boolean) : [],
    isHot: Boolean(row.is_hot),
    isPinned: Boolean(row.is_pinned),
    views: row.views || 0,
    likes: row.likes || 0,
    status: row.status || (row.moderation_status === 'rejected' ? 'rejected' : (row.moderation_status === 'approved' ? 'active' : 'pending')),
    moderationStatus: row.moderation_status || 'approved',
    expiresAt: row.expires_at || (row.deadline ? row.deadline : null),
    createdAt: row.created_at
  };
}

/**
 * GET /api/jobs
 * Lấy danh sách việc làm có lọc, hỗ trợ SQL Full-Text Search và bắt buộc Phân trang (Pagination)
 * Mặc định: limit 20, trần tối đa: limit 50
 */
router.get('/', cacheJobsMiddleware(60), async (req, res) => {
  try {
    const { category, district, job_type, time_shift, keyword, is_hot, active_only, exclude_expired, page, limit } = req.query;

    // 1. Chuẩn hóa phân trang bắt buộc (Pagination defaults: limit=20, max=50)
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereSql = ' WHERE 1=1';
    const params = [];

    if (category) {
      whereSql += ' AND category = ?';
      params.push(category);
    }
    if (district) {
      whereSql += ' AND district ILIKE ?';
      params.push(`%${district}%`);
    }
    if (job_type) {
      whereSql += ' AND job_type = ?';
      params.push(job_type);
    }
    if (time_shift) {
      whereSql += ' AND time_shift = ?';
      params.push(time_shift);
    }
    if (is_hot) {
      whereSql += ' AND is_hot = 1';
    }

    // Lọc bỏ tin đã hết hạn nộp hồ sơ
    if (active_only === 'true' || exclude_expired === 'true') {
      whereSql += " AND (deadline IS NULL OR deadline = '' OR deadline >= CURRENT_DATE::text)";
    }

    // Chỉ hiển thị tin đã được phê duyệt kiểm duyệt
    whereSql += " AND (moderation_status IS NULL OR moderation_status = 'approved')";

    // 2. Tối ưu tìm kiếm việc làm bằng cấu hình PostgreSQL Full-Text Search (FTS)
    if (keyword && keyword.trim()) {
      const cleanKeyword = keyword.trim();
      whereSql += ` AND (
        to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(company, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(district, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(requirements, '') || ' ' || COALESCE(hashtags, '')) @@ plainto_tsquery('simple', ?)
        OR title ILIKE ?
        OR company ILIKE ?
        OR hashtags ILIKE ?
      )`;
      params.push(cleanKeyword, `%${cleanKeyword}%`, `%${cleanKeyword}%`, `%${cleanKeyword}%`);
    }

    // 3. Đếm tổng số bản ghi thỏa mãn điều kiện lọc (COUNT(*) trực tiếp từ DB)
    const countRow = await get(`SELECT COUNT(*) as total FROM jobs${whereSql}`, params);
    const total = parseInt(countRow?.total, 10) || 0;
    const totalPages = Math.ceil(total / limitNum) || 1;

    // 4. Lấy dữ liệu phân trang trực tiếp ở tầng SQL
    const dataSql = `
      SELECT * FROM jobs 
      ${whereSql} 
      ORDER BY is_pinned DESC, is_hot DESC, created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const rows = await query(dataSql, [...params, limitNum, offset]);
    const formatted = rows.map(formatJobRow);

    const pagination = {
      total,
      currentPage: pageNum,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    };

    res.json({
      success: true,
      count: formatted.length,
      total,
      currentPage: pageNum,
      totalPages,
      limit: limitNum,
      pagination,
      jobs: formatted
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách việc làm:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * POST /api/jobs/ai-search
 * Bóc tách ngôn ngữ tự nhiên và xếp hạng công việc phù hợp
 */
router.post('/ai-search', async (req, res) => {
  try {
    const { query: naturalQuery = '', filters = {} } = req.body || {};
    const rows = await query('SELECT * FROM jobs ORDER BY is_pinned DESC, created_at DESC');
    const allJobs = rows.map(formatJobRow);


    const { extractedCriteria, rankedJobs } = filterAndRankJobs(allJobs, naturalQuery, filters);

    res.json({
      success: true,
      extractedCriteria,
      count: rankedJobs.length,
      rankedJobs,
      jobs: rankedJobs
    });
  } catch (error) {
    console.error('Lỗi AI Search:', error);
    res.status(500).json({ success: false, message: 'Lỗi bóc tách AI' });
  }
});

/**
 * GET /api/jobs/my
 * Lấy danh sách tin tuyển dụng của employer đang đăng nhập
 */
router.get('/my', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const employerId = req.user.id;
    const rows = await query(
      'SELECT * FROM jobs WHERE employer_id = ? ORDER BY created_at DESC',
      [employerId]
    );
    const formatted = rows.map(formatJobRow);
    res.json({ success: true, count: formatted.length, jobs: formatted });
  } catch (error) {
    console.error('Lỗi lấy jobs của employer:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * GET /api/jobs/bookmarks
 * Lấy danh sách việc làm đã lưu của người dùng hiện tại
 */
router.get('/bookmarks', authenticateToken, async (req, res) => {
  try {
    const rows = await query(`
      SELECT j.*, b.created_at as bookmarked_at 
      FROM job_bookmarks b
      JOIN jobs j ON b.job_id = j.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `, [req.user.id]);

    const formatted = rows.map(formatJobRow);
    res.json({ success: true, count: formatted.length, jobs: formatted });
  } catch (error) {
    console.error('Lỗi lấy danh sách việc làm đã lưu:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * GET /api/jobs/:id
 * Xem chi tiết công việc
 */
router.get('/:id', async (req, res) => {
  try {
    const row = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc làm' });
    }

    // Increment view count
    await run('UPDATE jobs SET views = views + 1 WHERE id = ?', [req.params.id]);
    row.views = (row.views || 0) + 1;

    res.json({ success: true, job: formatJobRow(row) });
  } catch (error) {
    console.error('Lỗi lấy chi tiết công việc:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * POST /api/jobs/:id/bookmark
 * Lưu tin tuyển dụng vào danh sách yêu thích
 */
router.post('/:id/bookmark', authenticateToken, async (req, res) => {
  try {
    const job = await get('SELECT id FROM jobs WHERE id = ?', [req.params.id]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc làm' });
    }

    const bookmarkId = `bm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await run(`
      INSERT INTO job_bookmarks (id, user_id, job_id)
      VALUES (?, ?, ?)
      ON CONFLICT (user_id, job_id) DO NOTHING
    `, [bookmarkId, req.user.id, req.params.id]);

    res.json({ success: true, message: 'Đã lưu việc làm vào danh sách yêu thích!' });
  } catch (error) {
    console.error('Lỗi bookmark:', error);
    res.status(500).json({ success: false, message: 'Lỗi lưu tin tuyển dụng' });
  }
});

/**
 * DELETE /api/jobs/:id/bookmark
 * Bỏ lưu tin tuyển dụng khỏi danh sách yêu thích
 */
router.delete('/:id/bookmark', authenticateToken, async (req, res) => {
  try {
    await run('DELETE FROM job_bookmarks WHERE user_id = ? AND job_id = ?', [req.user.id, req.params.id]);
    res.json({ success: true, message: 'Đã xóa việc làm khỏi danh sách đã lưu.' });
  } catch (error) {
    console.error('Lỗi bỏ bookmark:', error);
    res.status(500).json({ success: false, message: 'Lỗi bỏ lưu tin tuyển dụng' });
  }
});

/**
 * PATCH /api/jobs/:id/moderate
 * Quản trị viên duyệt hoặc từ chối tin tuyển dụng
 */
router.patch('/:id/moderate', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới có quyền kiểm duyệt tin tuyển dụng' });
    }

    const { status } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái kiểm duyệt không hợp lệ (approved, rejected)' });
    }

    const jobStatus = status === 'approved' ? 'active' : 'rejected';
    await run('UPDATE jobs SET moderation_status = ?, status = ? WHERE id = ?', [status, jobStatus, req.params.id]);
    await invalidateJobsCache();

    observability.logAudit({
      action: 'ADMIN_MODERATE_JOB',
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: req.params.id,
      details: { moderationStatus: status, jobStatus },
      ip: req.ip
    });

    res.json({ success: true, message: `Đã cập nhật trạng thái kiểm duyệt thành [${status}] (Trạng thái hiển thị: ${jobStatus})` });
  } catch (error) {
    console.error('Lỗi kiểm duyệt tin:', error);
    res.status(500).json({ success: false, message: 'Lỗi kiểm duyệt tin' });
  }
});

/**
 * PATCH /api/jobs/:id/status
 * Cập nhật trạng thái tin tuyển dụng (NTD sở hữu tin hoặc Admin)
 * Cho phép chuyển đổi giữa: 'pending', 'active', 'rejected', 'expired'
 */
router.patch('/:id/status', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const job = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin tuyển dụng' });
    }

    if (req.user.role !== 'admin' && job.employer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa trạng thái bài đăng này' });
    }

    const { status } = req.body;
    const allowedStatuses = ['pending', 'active', 'rejected', 'expired'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Trạng thái không hợp lệ. Cho phép: ${allowedStatuses.join(', ')}` 
      });
    }

    await run('UPDATE jobs SET status = ? WHERE id = ?', [status, req.params.id]);
    await invalidateJobsCache();

    observability.logAudit({
      action: 'JOB_STATUS_CHANGE',
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: req.params.id,
      details: { previousStatus: job.status, newStatus: status },
      ip: req.ip
    });

    const updatedJob = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      message: `Đã cập nhật trạng thái tin tuyển dụng thành [${status}]`,
      job: formatJobRow(updatedJob)
    });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái job:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * POST /api/jobs/cron/expire-now
 * Kích hoạt thủ công tiến trình quét và chuyển trạng thái các tin quá hạn sang 'expired'
 */
router.post('/cron/expire-now', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới có quyền kích hoạt tiến trình này' });
    }
    const result = await autoExpireOutdatedJobs();
    res.json({
      success: true,
      message: `Đã thực thi quét tin quá hạn: cập nhật ${result.updatedCount} tin sang trạng thái 'expired'`,
      result
    });
  } catch (error) {
    console.error('Lỗi chạy cron expire thủ công:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi chạy quét tin quá hạn' });
  }
});

/**
 * POST /api/jobs
 * Đăng tin tuyển dụng mới (Chỉ Nhà tuyển dụng hoặc Admin)
 * Mặc định: status = 'pending', moderation_status = 'pending'
 */
router.post('/', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const b = req.body;
    if (!b.title || !b.title.trim()) {
      return res.status(400).json({ success: false, message: 'Tiêu đề công việc là bắt buộc' });
    }
    const id = `job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const employerId = req.user.id;
    const companyName = b.company || req.user.name || 'Doanh nghiệp tuyển dụng';
    // ⚠️ Bảo mật: chỉ admin mới được đặt isHot/isPinned
    const isHot = req.user.role === 'admin' ? (b.isHot ? 1 : 0) : 0;
    const isPinned = req.user.role === 'admin' ? (b.isPinned ? 1 : 0) : 0;

    // Business Logic Moderation: Mặc định job mới tạo là 'pending'
    const status = 'pending';
    const moderationStatus = 'pending';

    // Tính toán expires_at: Ưu tiên b.expiresAt -> b.deadline -> Mặc định +30 ngày
    let expiresAt = null;
    if (b.expiresAt) {
      const expDate = new Date(b.expiresAt);
      if (!isNaN(expDate.getTime())) {
        expiresAt = expDate.toISOString();
      }
    } else if (b.deadline) {
      const deadlineDate = new Date(b.deadline.includes('T') ? b.deadline : `${b.deadline}T23:59:59Z`);
      if (!isNaN(deadlineDate.getTime())) {
        expiresAt = deadlineDate.toISOString();
      }
    }
    if (!expiresAt) {
      // Mặc định hết hạn sau 30 ngày kể từ lúc đăng tin
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    await run(`
      INSERT INTO jobs (
        id, employer_id, title, company, company_logo, category, district, city, address,
        salary_display, salary_type, salary_min, salary_max, job_type, time_shift,
        time_hours, experience, description, requirements, benefits, slots, deadline,
        hashtags, is_hot, is_pinned, status, moderation_status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      employerId,
      b.title,
      companyName,
      b.companyLogo || '🏢',
      b.category || 'F&B',
      b.district || 'Cầu Giấy',
      b.city || 'Hà Nội',
      b.address || `${b.district || 'Cầu Giấy'}, Hà Nội`,
      b.salaryDisplay || 'Thỏa thuận',
      b.salaryType || 'hourly',
      b.salaryMin || 30000,
      b.salaryMax || 40000,
      b.jobType || 'PART_TIME',
      b.timeShift || 'Tối',
      b.timeHours || 'Linh hoạt',
      b.experience || 'NO_EXPERIENCE',
      b.description || '',
      JSON.stringify(Array.isArray(b.requirements) ? b.requirements : [b.requirements].filter(Boolean)),
      JSON.stringify(Array.isArray(b.benefits) ? b.benefits : [b.benefits].filter(Boolean)),
      Number(b.slots) || 1,
      b.deadline || '2026-11-01',
      Array.isArray(b.hashtags) ? b.hashtags.join(' ') : (b.hashtags || ''),
      isHot,
      isPinned,
      status,
      moderationStatus,
      expiresAt
    ]);

    const created = await get('SELECT * FROM jobs WHERE id = ?', [id]);
    await invalidateJobsCache();
    res.status(201).json({ success: true, message: 'Đăng tin thành công! Tin của bạn đang ở trạng thái chờ duyệt (pending).', job: formatJobRow(created) });
  } catch (error) {
    console.error('Lỗi đăng tin:', error);
    res.status(500).json({ success: false, message: 'Lỗi đăng tin' });
  }
});

/**
 * POST /api/jobs/:id/boost
 * Đẩy tin Hot hoặc Ghim tin (Chỉ Quản trị viên - Admin)
 */
router.post('/:id/boost', authenticateToken, async (req, res) => {
  try {
    // 🔒 Chỉ admin được ghim / đánh dấu hot
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ quản trị viên mới có quyền ghim hoặc đánh dấu tin tuyển dụng nổi bật' 
      });
    }

    const job = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin tuyển dụng' });
    }

    const { type } = req.body; // 'hot' or 'pin'
    if (type === 'hot') {
      await run('UPDATE jobs SET is_hot = 1 WHERE id = ?', [req.params.id]);
    } else if (type === 'pin') {
      await run('UPDATE jobs SET is_pinned = 1 WHERE id = ?', [req.params.id]);
    }

    observability.logAudit({
      action: 'JOB_BOOST',
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: req.params.id,
      details: { type, title: job.title },
      ip: req.ip
    });

    await invalidateJobsCache();
    res.json({ success: true, message: 'Đã nâng cấp tin tuyển dụng thành công!' });
  } catch (error) {
    console.error('Lỗi boost tin:', error);
    res.status(500).json({ success: false, message: 'Lỗi nâng cấp tin' });
  }
});

/**
 * PUT /api/jobs/:id
 * Chỉnh sửa tin tuyển dụng (Yêu cầu chính chủ bài đăng hoặc Quản trị viên)
 */
router.put('/:id', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const job = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin tuyển dụng' });
    }

    // Ownership verification
    if (req.user.role !== 'admin' && job.employer_id !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Từ chối quyền (403 Forbidden): Bạn không thể chỉnh sửa bài đăng của nhà tuyển dụng khác!' 
      });
    }

    const b = req.body;
    const reqJson = JSON.stringify(Array.isArray(b.requirements) ? b.requirements : (typeof b.requirements === 'string' ? b.requirements.split(',').map(s => s.trim()).filter(Boolean) : []));
    const benJson = JSON.stringify(Array.isArray(b.benefits) ? b.benefits : (typeof b.benefits === 'string' ? b.benefits.split(',').map(s => s.trim()).filter(Boolean) : []));
    const hashtagsStr = Array.isArray(b.hashtags) ? b.hashtags.join(' ') : (b.hashtags || '');
    // ⚠ï¸ Bảo mật: chỉ admin mới được thay đổi isHot/isPinned
    const newIsHot = req.user.role === 'admin'
      ? (b.isHot !== undefined ? (b.isHot ? 1 : 0) : job.is_hot)
      : job.is_hot;
    const newIsPinned = req.user.role === 'admin'
      ? (b.isPinned !== undefined ? (b.isPinned ? 1 : 0) : job.is_pinned)
      : job.is_pinned;

    await run(`
      UPDATE jobs SET
        title = ?,
        company = ?,
        company_logo = ?,
        category = ?,
        district = ?,
        city = ?,
        address = ?,
        salary_display = ?,
        salary_type = ?,
        salary_min = ?,
        salary_max = ?,
        job_type = ?,
        time_shift = ?,
        time_hours = ?,
        experience = ?,
        description = ?,
        requirements = ?,
        benefits = ?,
        slots = ?,
        deadline = ?,
        hashtags = ?,
        is_hot = ?,
        is_pinned = ?
      WHERE id = ?
    `, [
      b.title ?? job.title,
      b.company ?? job.company,
      b.companyLogo ?? job.company_logo,
      b.category ?? job.category,
      b.district ?? job.district,
      b.city ?? job.city,
      b.address ?? job.address,
      b.salaryDisplay ?? job.salary_display,
      b.salaryType ?? job.salary_type,
      b.salaryMin !== undefined ? Number(b.salaryMin) : job.salary_min,
      b.salaryMax !== undefined ? Number(b.salaryMax) : job.salary_max,
      b.jobType ?? job.job_type,
      b.timeShift ?? job.time_shift,
      b.timeHours ?? job.time_hours,
      b.experience ?? job.experience,
      b.description ?? job.description,
      reqJson,
      benJson,
      b.slots !== undefined ? Number(b.slots) : job.slots,
      b.deadline ?? job.deadline,
      hashtagsStr,
      newIsHot,
      newIsPinned,
      req.params.id
    ]);

    const updated = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
    await invalidateJobsCache();
    res.json({
      success: true,
      message: 'Cập nhật tin tuyển dụng thành công!',
      job: formatJobRow(updated)
    });
  } catch (error) {
    console.error('Lỗi cập nhật tin tuyển dụng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật' });
  }
});

/**
 * DELETE /api/jobs/:id
 * Xóa tin tuyển dụng (Yêu cầu chính chủ bài đăng hoặc Quản trị viên)
 */
router.delete('/:id', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const job = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin tuyển dụng' });
    }

    // Ownership verification
    if (req.user.role !== 'admin' && job.employer_id !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Từ chối quyền (403 Forbidden): Bạn không thể xóa bài đăng của nhà tuyển dụng khác!' 
      });
    }

    const jobId = req.params.id;

    // 1. Lấy danh sách applications liên quan để dọn sạch dữ liệu liên đới
    const appRows = await query('SELECT id FROM applications WHERE job_id = ?', [jobId]).catch(() => []);
    const appIds = appRows.map(a => a.id);

    // 2. Dọn sạch tin nhắn chat & thread liên quan tới job này
    await run('DELETE FROM chat_messages WHERE thread_id ILIKE ?', [`%thread_job_${jobId}%`]).catch(() => {});
    for (const appId of appIds) {
      await run('DELETE FROM chat_messages WHERE thread_id = ?', [`thread_app_${appId}`]).catch(() => {});
    }
    await run('DELETE FROM chat_messages WHERE thread_id IN (SELECT id FROM chat_threads WHERE job_id = ?)', [jobId]).catch(() => {});
    await run('DELETE FROM chat_threads WHERE job_id = ?', [jobId]).catch(() => {});

    // 3. Dọn sạch thông báo (notifications) liên quan tới job và các application của job
    await run('DELETE FROM notifications WHERE link_type = ? AND link_id = ?', ['job', jobId]).catch(() => {});
    for (const appId of appIds) {
      await run('DELETE FROM notifications WHERE link_type = ? AND link_id = ?', ['application', appId]).catch(() => {});
    }

    // 4. Dọn sạch ratings, applications, rồi xóa job
    await run('DELETE FROM ratings WHERE job_id = ?', [jobId]).catch(() => {});
    await run('DELETE FROM applications WHERE job_id = ?', [jobId]).catch(() => {});
    await run('DELETE FROM jobs WHERE id = ?', [jobId]);
    await invalidateJobsCache();

    res.json({ success: true, message: 'Đã xóa tin tuyển dụng và toàn bộ dữ liệu liên quan thành công' });
  } catch (error) {
    console.error('Lỗi xóa tin:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

export default router;
