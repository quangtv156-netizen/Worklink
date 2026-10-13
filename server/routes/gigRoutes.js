import express from 'express';
import crypto from 'crypto';
import { query, get, run } from '../db.js';
import { authenticateToken, requireEmployerOrAdmin } from '../middleware/auth.js';

const router = express.Router();

function formatGigRow(r) {
  return {
    id: r.id,
    employerId: r.employer_id,
    employer_id: r.employer_id,
    title: r.title,
    reward: r.reward,
    rewardNum: r.reward_num,
    time: r.time_needed,
    cargoType: r.cargo_type,
    isValuable: Boolean(r.is_valuable),
    requiresContract: Boolean(r.requires_contract),
    pickupLocation: {
      name: r.pickup_name,
      address: r.pickup_address || r.pickup_name,
      lat: Number(r.pickup_lat),
      lng: Number(r.pickup_lng)
    },
    dropoffLocation: {
      name: r.dropoff_name,
      address: r.dropoff_address || r.dropoff_name,
      lat: Number(r.dropoff_lat),
      lng: Number(r.dropoff_lng)
    },
    distanceKm: Number(r.distance_km) || 0,
    note: r.note,
    sender: r.sender,
    receiver: r.receiver,
    status: r.status,
    acceptedBy: r.accepted_by,
    acceptedByName: r.accepted_by_name || (r.accepted_by?.startsWith('user-') ? 'Ứng viên' : r.accepted_by),
    createdAt: r.created_at
  };
}

// GET /api/gigs - Lấy danh sách việc vặt (hỗ trợ filter theo employer_id, status và phân trang)
router.get('/', async (req, res) => {
  try {
    const { employer_id, status, page, limit } = req.query;
    let sql = 'SELECT * FROM gig_tasks WHERE 1=1';
    const params = [];
    if (employer_id) {
      sql += ' AND employer_id = ?';
      params.push(employer_id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await query(sql, params);
    const formatted = rows.map(formatGigRow);

    const total = formatted.length;
    let paginatedGigs = formatted;
    let pagination = null;

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const totalPages = Math.ceil(total / limitNum) || 1;
      const offset = (pageNum - 1) * limitNum;
      paginatedGigs = formatted.slice(offset, offset + limitNum);
      pagination = {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      };
    } else {
      const MAX_DEFAULT_LIMIT = 50;
      if (paginatedGigs.length > MAX_DEFAULT_LIMIT) {
        paginatedGigs = paginatedGigs.slice(0, MAX_DEFAULT_LIMIT);
      }
    }

    res.json({
      success: true,
      count: paginatedGigs.length,
      total,
      pagination,
      gigs: paginatedGigs
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách việc vặt:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

// GET /api/gigs/mine - Lấy danh sách việc vặt của chính employer đang đăng nhập
router.get('/mine', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const employerId = req.user.id;
    const rows = await query(
      'SELECT * FROM gig_tasks WHERE employer_id = ? ORDER BY created_at DESC',
      [employerId]
    );
    const formatted = rows.map(formatGigRow);
    res.json({ success: true, count: formatted.length, gigs: formatted });
  } catch (error) {
    console.error('Lỗi lấy danh sách việc vặt của tôi:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

// GET /api/gigs/:id - Xem chi tiết việc vặt
router.get('/:id', async (req, res) => {
  try {
    const row = await get('SELECT * FROM gig_tasks WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc vặt' });
    }
    res.json({ success: true, gig: formatGigRow(row) });
  } catch (error) {
    console.error('Lỗi lấy chi tiết việc vặt:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

// POST /api/gigs - Đăng cuốc việc vặt mới (Chỉ employer hoặc admin)
router.post('/', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const {
      title, reward, rewardNum, time, cargoType, isValuable, requiresContract,
      pickupLocation, dropoffLocation, pickup, dropoff, distanceKm, note, sender, receiver
    } = req.body;

    const pLoc = pickupLocation || pickup;
    const dLoc = dropoffLocation || dropoff;

    if (!title?.trim() || !reward || !pLoc || !dLoc) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin việc vặt bắt buộc (tiêu đề, phần thưởng, điểm lấy, điểm giao)' });
    }

    const id = `gig-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const employerId = req.user.id;

    await run(`
      INSERT INTO gig_tasks (
        id, employer_id, title, reward, reward_num, time_needed, cargo_type, is_valuable, requires_contract,
        pickup_name, pickup_address, pickup_lat, pickup_lng,
        dropoff_name, dropoff_address, dropoff_lat, dropoff_lng,
        distance_km, note, sender, receiver, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')
    `, [
      id,
      employerId,
      title.trim(),
      reward,
      Number(rewardNum) || 0,
      time || '30 phút',
      cargoType || 'Tài liệu / Đồ nhỏ',
      isValuable ? 1 : 0,
      requiresContract ? 1 : 0,
      pLoc.name || pLoc.address || 'Điểm lấy hàng',
      pLoc.address || pLoc.name || '',
      Number(pLoc.lat) || 21.0285,
      Number(pLoc.lng) || 105.8542,
      dLoc.name || dLoc.address || 'Điểm giao hàng',
      dLoc.address || dLoc.name || '',
      Number(dLoc.lat) || 21.0333,
      Number(dLoc.lng) || 105.8433,
      Number(distanceKm) || 2.5,
      note || '',
      sender || req.user.name || 'Người gửi',
      receiver || 'Người nhận'
    ]);

    const created = await get('SELECT * FROM gig_tasks WHERE id = ?', [id]);
    res.status(201).json({
      success: true,
      message: 'Tạo việc vặt thành công!',
      gig: formatGigRow(created)
    });
  } catch (error) {
    console.error('Lỗi tạo việc vặt:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo việc vặt' });
  }
});

// PUT /api/gigs/:id - Sửa thông tin việc vặt (Chỉ chủ sở hữu hoặc admin)
router.put('/:id', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const gig = await get('SELECT * FROM gig_tasks WHERE id = ?', [req.params.id]);
    if (!gig) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc vặt cần chỉnh sửa' });
    }

    // Kiểm tra quyền sở hữu: Phải là admin hoặc đúng employer_id
    if (req.user.role !== 'admin' && gig.employer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Từ chối quyền (403 Forbidden): Bạn không thể chỉnh sửa việc vặt của nhà tuyển dụng khác!'
      });
    }

    if (gig.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Không thể chỉnh sửa công việc đã hoàn thành!'
      });
    }

    const b = req.body;
    const pLoc = b.pickupLocation || b.pickup || {};
    const dLoc = b.dropoffLocation || b.dropoff || {};

    // 🔒 Bảo mật: Tuyệt đối không cho phép đổi status tùy ý qua PUT /:id
    // Trạng thái chỉ được chuyển đổi tuần tự qua POST /:id/accept và POST /:id/complete
    await run(`
      UPDATE gig_tasks SET
        title = ?,
        reward = ?,
        reward_num = ?,
        time_needed = ?,
        cargo_type = ?,
        is_valuable = ?,
        requires_contract = ?,
        pickup_name = ?,
        pickup_address = ?,
        pickup_lat = ?,
        pickup_lng = ?,
        dropoff_name = ?,
        dropoff_address = ?,
        dropoff_lat = ?,
        dropoff_lng = ?,
        distance_km = ?,
        note = ?,
        sender = ?,
        receiver = ?
      WHERE id = ?
    `, [
      b.title?.trim() ?? gig.title,
      b.reward ?? gig.reward,
      b.rewardNum !== undefined ? Number(b.rewardNum) : gig.reward_num,
      b.time ?? gig.time_needed,
      b.cargoType ?? gig.cargo_type,
      b.isValuable !== undefined ? (b.isValuable ? 1 : 0) : gig.is_valuable,
      b.requiresContract !== undefined ? (b.requiresContract ? 1 : 0) : gig.requires_contract,
      pLoc.name ?? gig.pickup_name,
      pLoc.address ?? gig.pickup_address,
      pLoc.lat !== undefined ? Number(pLoc.lat) : gig.pickup_lat,
      pLoc.lng !== undefined ? Number(pLoc.lng) : gig.pickup_lng,
      dLoc.name ?? gig.dropoff_name,
      dLoc.address ?? gig.dropoff_address,
      dLoc.lat !== undefined ? Number(dLoc.lat) : gig.dropoff_lat,
      dLoc.lng !== undefined ? Number(dLoc.lng) : gig.dropoff_lng,
      b.distanceKm !== undefined ? Number(b.distanceKm) : gig.distance_km,
      b.note ?? gig.note,
      b.sender ?? gig.sender,
      b.receiver ?? gig.receiver,
      req.params.id
    ]);

    const updated = await get('SELECT * FROM gig_tasks WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      message: 'Cập nhật việc vặt thành công!',
      gig: formatGigRow(updated)
    });
  } catch (error) {
    console.error('Lỗi cập nhật việc vặt:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật việc vặt' });
  }
});

// DELETE /api/gigs/:id - Xóa việc vặt (Chỉ chủ sở hữu hoặc admin, không cho xóa nếu ACCEPTED hoặc COMPLETED)
router.delete('/:id', authenticateToken, requireEmployerOrAdmin, async (req, res) => {
  try {
    const gig = await get('SELECT * FROM gig_tasks WHERE id = ?', [req.params.id]);
    if (!gig) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc vặt cần xóa' });
    }

    // Kiểm tra quyền sở hữu
    if (req.user.role !== 'admin' && gig.employer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Từ chối quyền (403 Forbidden): Bạn không thể xóa việc vặt của nhà tuyển dụng khác!'
      });
    }

    // Quy tắc an toàn: Không cho xóa nếu status đã là ACCEPTED hoặc COMPLETED
    if (gig.status === 'ACCEPTED' || gig.status === 'COMPLETED') {
      const statusLabel = gig.status === 'ACCEPTED' ? 'ĐANG THỰC HIỆN (ACCEPTED)' : 'ĐÃ HOÀN THÀNH (COMPLETED)';
      return res.status(400).json({
        success: false,
        message: `Không thể xóa việc vặt đang ở trạng thái [${statusLabel}]. Để bảo vệ quyền lợi ứng viên, chỉ việc vặt chưa có người nhận (AVAILABLE) mới được phép xóa!`
      });
    }

    await run('DELETE FROM gig_tasks WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      message: 'Đã xóa việc vặt thành công!'
    });
  } catch (error) {
    console.error('Lỗi xóa việc vặt:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa việc vặt' });
  }
});

// POST /api/gigs/:id/accept - Ứng viên nhận cuốc việc vặt (Atomic Operation - Chống Race Condition)
router.post('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const gig = await get('SELECT id, employer_id, status FROM gig_tasks WHERE id = ?', [req.params.id]);
    if (!gig) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc vặt' });
    }

    if (gig.status !== 'AVAILABLE') {
      return res.status(400).json({ success: false, message: 'Việc vặt này không còn mở nhận hoặc đã có người nhận!' });
    }

    // Không cho chủ sở hữu tự nhận cuốc của chính mình
    if (gig.employer_id && gig.employer_id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Bạn là người đăng cuốc này, không thể tự nhận cuốc của mình!' });
    }

    // Chỉ job_seeker mới được nhận cuốc việc vặt (employer/admin không phải người thực hiện)
    if (req.user.role !== 'job_seeker') {
      return res.status(403).json({ success: false, message: 'Chỉ ứng viên (job seeker) mới có thể nhận cuốc việc vặt!' });
    }

    const acceptorId = req.user.id;
    const acceptorName = req.user.name || 'Người tìm việc';

    // ATOMIC UPDATE: Chỉ cập nhật khi status = 'AVAILABLE' trực tiếp trong một câu truy vấn duy nhất
    const updateResult = await run(`
      UPDATE gig_tasks 
      SET status = 'ACCEPTED', accepted_by = ?, accepted_by_name = ? 
      WHERE id = ? AND status = 'AVAILABLE'
    `, [acceptorId, acceptorName, req.params.id]);

    if (!updateResult.rowCount && !updateResult.changes) {
      return res.status(409).json({
        success: false,
        message: 'Rất tiếc! Việc vặt này đã được một người khác nhận trước trong tích tắc.'
      });
    }

    res.json({ 
      success: true, 
      message: 'Đã nhận cuốc việc vặt thành công!',
      acceptedBy: acceptorId,
      acceptedByName: acceptorName
    });
  } catch (error) {
    console.error('Lỗi nhận đơn việc vặt:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

// POST /api/gigs/:id/complete - Hoàn thành cuốc việc vặt
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const gig = await get('SELECT * FROM gig_tasks WHERE id = ?', [req.params.id]);
    if (!gig) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc vặt' });
    }

    // Bắt buộc việc vặt phải ở trạng thái ACCEPTED mới được chuyển sang COMPLETED
    if (gig.status === 'AVAILABLE') {
      return res.status(400).json({ success: false, message: 'Việc vặt chưa có người nhận làm (đang mở), không thể hoàn thành!' });
    }
    if (gig.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Việc vặt này đã được hoàn thành trước đó rồi!' });
    }
    if (gig.status !== 'ACCEPTED') {
      return res.status(400).json({ success: false, message: 'Trạng thái việc vặt không hợp lệ để hoàn thành' });
    }

    const isAuthorized = req.user.role === 'admin' || gig.employer_id === req.user.id || gig.accepted_by === req.user.id;
    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền đánh dấu hoàn thành việc vặt này' });
    }

    const updateResult = await run(`UPDATE gig_tasks SET status = 'COMPLETED' WHERE id = ? AND status = 'ACCEPTED'`, [req.params.id]);
    if (!updateResult.rowCount && !updateResult.changes) {
      return res.status(409).json({ success: false, message: 'Không thể cập nhật trạng thái việc vặt' });
    }

    res.json({ success: true, message: 'Đã hoàn thành cuốc việc vặt thành công!' });
  } catch (error) {
    console.error('Lỗi hoàn thành việc vặt:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

// POST /api/gigs/:id/confirm-completion - Nhà tuyển dụng xác nhận nghiệm thu và giải phóng thù lao (Escrow)
router.post('/:id/confirm-completion', authenticateToken, async (req, res) => {
  try {
    const gig = await get('SELECT * FROM gig_tasks WHERE id = ?', [req.params.id]);
    if (!gig) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy việc vặt' });
    }

    if (req.user.role !== 'admin' && gig.employer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Chỉ người đăng việc mới có quyền xác nhận nghiệm thu và giải phóng thù lao' });
    }

    if (gig.status !== 'COMPLETED') {
      await run(`UPDATE gig_tasks SET status = 'COMPLETED' WHERE id = ?`, [req.params.id]);
    }

    res.json({
      success: true,
      message: `Đã nghiệm thu và xác nhận giải phóng thù lao [${gig.reward}] thành công cho người thực hiện!`,
      gigId: gig.id,
      reward: gig.reward
    });
  } catch (error) {
    console.error('Lỗi nghiệm thu việc vặt:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

export default router;
