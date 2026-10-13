import express from 'express';
import crypto from 'crypto';
import { query, get, run } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from './notificationRoutes.js';

const router = express.Router();

// POST /api/ratings - Submit a rating (BẮT BUỘC ĐĂNG NHẬP, KIỂM TRA ĐÃ ỨNG TUYỂN, CHỐNG TRÙNG)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { jobId, applicationId, targetType, stars, comment, tags, isAnonymous } = req.body;
    if (!jobId || !targetType || !stars || stars < 1 || stars > 5) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin hoặc số sao không hợp lệ (1-5)' });
    }

    // Whitelist targetType
    if (!['company', 'applicant'].includes(targetType)) {
      return res.status(400).json({ success: false, message: 'Loại đánh giá không hợp lệ (chỉ hỗ trợ "company" hoặc "applicant")' });
    }

    const reviewerId = req.user.id;
    const reviewerRole = req.user.role || 'job_seeker';

    // 1. Phân quyền vai trò: Chỉ job_seeker hoặc employer mới được gửi đánh giá
    if (reviewerRole !== 'job_seeker' && reviewerRole !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Từ chối quyền: Quản trị viên không tham gia gửi đánh giá trực tiếp. Tính năng đánh giá chỉ dành cho ứng viên và nhà tuyển dụng tham gia ứng tuyển!'
      });
    }

    if (reviewerRole === 'job_seeker' && targetType !== 'company') {
      return res.status(403).json({ success: false, message: 'Ứng viên chỉ có thể đánh giá nhà tuyển dụng/công ty!' });
    }

    if (reviewerRole === 'employer' && targetType !== 'applicant') {
      return res.status(403).json({ success: false, message: 'Nhà tuyển dụng chỉ có thể đánh giá ứng viên!' });
    }

    // 2. Kiểm tra job có tồn tại không
    const job = await get('SELECT id, employer_id, company, title FROM jobs WHERE id = ?', [jobId]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin tuyển dụng để đánh giá' });
    }

    // 3. Chống đánh giá trùng lặp (Mỗi tài khoản chỉ được đánh giá 1 lần cho 1 công việc)
    const existingRating = await get('SELECT id FROM ratings WHERE job_id = ? AND reviewer_id = ?', [jobId, reviewerId]);
    if (existingRating) {
      return res.status(409).json({ success: false, message: 'Bạn đã gửi đánh giá cho công việc này rồi!' });
    }

    // 4. Kiểm tra quyền sở hữu & liên kết application
    let verifiedAppId = null;

    if (reviewerRole === 'job_seeker') {
      // BẮT BUỘC phải là người đã từng nộp hồ sơ ứng tuyển vào công việc này
      const app = await get(
        'SELECT id, status FROM applications WHERE job_id = ? AND user_id = ?',
        [jobId, reviewerId]
      );
      if (!app) {
        return res.status(403).json({
          success: false,
          message: 'Từ chối quyền (403 Forbidden): Bạn chỉ có thể đánh giá nhà tuyển dụng sau khi đã nộp đơn ứng tuyển vị trí này!'
        });
      }
      verifiedAppId = app.id;
    } else if (reviewerRole === 'employer') {
      if (job.employer_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Từ chối quyền (403 Forbidden): Bạn chỉ có thể đánh giá ứng viên của công việc do chính mình đăng!'
        });
      }
      // Xác minh applicationId thực sự thuộc về công việc này
      if (!applicationId) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã hồ sơ ứng tuyển (applicationId) để đánh giá ứng viên' });
      }
      const app = await get('SELECT id, user_id FROM applications WHERE id = ? AND job_id = ?', [applicationId, jobId]);
      if (!app) {
        return res.status(404).json({ success: false, message: 'Hồ sơ ứng tuyển không tồn tại hoặc không thuộc tin tuyển dụng này!' });
      }
      verifiedAppId = app.id;
    }

    const id = `rate-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await run(
      `INSERT INTO ratings (id, job_id, application_id, reviewer_id, reviewer_role, target_type, stars, comment, tags, is_anonymous) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        jobId, 
        verifiedAppId || null, 
        reviewerId, 
        reviewerRole, 
        targetType, 
        stars, 
        comment || null, 
        tags ? JSON.stringify(tags) : null, 
        isAnonymous ? 1 : 0
      ]
    );

    // Gửi thông báo cho nhà tuyển dụng nhận đánh giá
    try {
      if (targetType === 'company' && job.employer_id && job.employer_id !== reviewerId) {
        await createNotification({
          userId: job.employer_id,
          type: 'rating',
          title: `Đánh giá mới cho tin: ${job.title}`,
          body: `Một ứng viên vừa đánh giá ${stars} ⭐ cho công ty của bạn: "${(comment || '').slice(0, 80)}"`,
          linkType: 'job',
          linkId: jobId
        });
      }
    } catch (notifErr) {
      console.warn('[Ratings] Lỗi tạo thông báo rating:', notifErr.message);
    }

    res.status(201).json({ success: true, message: 'Đã gửi đánh giá thành công!', id });
  } catch (e) {
    console.error('[Ratings] POST error:', e);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gửi đánh giá' });
  }
});

// GET /api/ratings/company/:company
router.get('/company/:company', async (req, res) => {
  try {
    const rows = await query(
      `SELECT r.*, j.company, j.title as job_title FROM ratings r
       LEFT JOIN jobs j ON r.job_id = j.id
       WHERE j.company ILIKE ? AND r.target_type = 'company'
       ORDER BY r.created_at DESC LIMIT 50`,
      [`%${req.params.company}%`]
    );
    const formatted = rows.map(r => ({
      id: r.id, company: r.company, jobTitle: r.job_title, stars: r.stars,
      comment: r.comment, tags: r.tags ? JSON.parse(r.tags) : [],
      isAnonymous: Boolean(r.is_anonymous), reviewerRole: r.reviewer_role, createdAt: r.created_at
    }));
    res.json({ success: true, count: formatted.length, ratings: formatted });
  } catch(e) {
    console.error('[Ratings] GET company error:', e);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
  }
});

// GET /api/ratings/stats/:company
router.get('/stats/:company', async (req, res) => {
  try {
    const rows = await query(
      `SELECT r.stars, r.tags FROM ratings r
       LEFT JOIN jobs j ON r.job_id = j.id
       WHERE j.company ILIKE ? AND r.target_type = 'company'`,
      [`%${req.params.company}%`]
    );
    if (!rows.length) return res.json({ success: true, count: 0, average: null, distribution: {}, topTags: [] });
    const avg = (rows.reduce((s,r) => s + r.stars, 0) / rows.length).toFixed(1);
    const dist = {5:0,4:0,3:0,2:0,1:0};
    const tagCount = {};
    rows.forEach(r => {
      dist[r.stars] = (dist[r.stars] || 0) + 1;
      if (r.tags) { try { JSON.parse(r.tags).forEach(t => { tagCount[t] = (tagCount[t]||0)+1; }); } catch(_){} }
    });
    const topTags = Object.entries(tagCount).sort((a,b) => b[1]-a[1]).slice(0,6).map(([tag,count]) => ({tag,count}));
    res.json({ success: true, count: rows.length, average: parseFloat(avg), distribution: dist, topTags });
  } catch(e) {
    console.error('[Ratings] GET stats error:', e);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
  }
});

export default router;
