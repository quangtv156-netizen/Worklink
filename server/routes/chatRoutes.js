import express from 'express';
import crypto from 'crypto';
import { query, run } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { canUserAccessThread, getThreadRecipient } from '../services/chatSecurity.js';
import { createNotification } from './notificationRoutes.js';

const router = express.Router();

/**
 * GET /api/chat/:threadId
 * Lấy lịch sử tin nhắn của một cuộc hội thoại (BẮT BUỘC ĐĂNG NHẬP & PHẢI THUỘC THREAD)
 */
router.get('/:threadId', authenticateToken, async (req, res) => {
  try {
    const { threadId } = req.params;
    const rawLimit = parseInt(req.query.limit);
    const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 100;

    // 🔒 Kiểm tra quyền truy cập thread
    const hasAccess = await canUserAccessThread(req.user.id, req.user.role, threadId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Từ chối quyền (403 Forbidden): Bạn không có quyền truy cập cuộc hội thoại này!'
      });
    }

    const messages = await query(
      `SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT ?`,
      [threadId, limit]
    );

    // Đảo ngược lại theo thứ tự thời gian tăng dần để client hiển thị từ cũ đến mới của limit tin nhắn mới nhất
    messages.reverse();

    res.json({ success: true, count: messages.length, messages });
  } catch (error) {
    console.error('[Chat] GET error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * POST /api/chat
 * Gửi tin nhắn qua HTTP (BẮT BUỘC ĐĂNG NHẬP, ĐÃ XÁC THỰC EMAIL & PHẢI THUỘC THREAD)
 */
router.post('/', authenticateToken, requireVerified, async (req, res) => {
  try {
    const { threadId, text } = req.body;
    if (!threadId || !text?.trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin gửi tin nhắn' });
    }

    // 🔒 M2: Yêu cầu xác thực email trước khi nhắn tin nếu kích hoạt
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && req.user.is_verified === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vui lòng xác thực email của bạn trước khi tham gia trò chuyện.'
      });
    }

    // 🔒 Kiểm tra quyền gửi tin nhắn vào thread
    const hasAccess = await canUserAccessThread(req.user.id, req.user.role, threadId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Từ chối quyền (403 Forbidden): Bạn không có quyền gửi tin nhắn vào cuộc hội thoại này!'
      });
    }

    const senderId = req.user.id;
    const senderName = req.user.name || 'Thành viên WorkLink';
    const senderRole = req.user.role || 'job_seeker';

    const msgId = `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const createdAt = new Date().toISOString();

    await run(
      `INSERT INTO chat_messages (id, thread_id, sender_id, sender_name, sender_role, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [msgId, threadId, senderId, senderName, senderRole, text.trim(), createdAt]
    );

    const recipientId = await getThreadRecipient(senderId, threadId);

    // 🔒 Kiểm tra xem người nhận có chặn người gửi không
    if (recipientId) {
      const isBlocked = await query(
        'SELECT id FROM chat_blocks WHERE blocker_id = ? AND blocked_id = ?',
        [recipientId, senderId]
      ).catch(() => []);

      if (isBlocked.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Không thể gửi tin nhắn: Đối phương đã chặn cuộc hội thoại này.'
        });
      }
    }

    const message = {
      id: msgId,
      threadId,
      senderId,
      senderName,
      senderRole,
      text: text.trim(),
      createdAt,
      isRead: 0
    };

    const io = req.app.get('io');
    if (io) {
      io.to(threadId).emit('new_message', message);
    }

    // Gửi thông báo chuông cho người nhận trong cuộc hội thoại
    try {
      if (recipientId && recipientId !== senderId) {
        await createNotification({
          userId: recipientId,
          type: 'message',
          title: `Tin nhắn mới từ ${senderName}`,
          body: text.trim().slice(0, 100),
          linkType: 'chat',
          linkId: threadId
        });
      }
    } catch (notifErr) {
      console.warn('[Chat] Lỗi tạo thông báo tin nhắn:', notifErr.message);
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('[Chat] POST error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * PUT /api/chat/:threadId/read
 * Đánh dấu toàn bộ tin nhắn trong cuộc hội thoại đã được đọc (Read Receipts)
 */
router.put('/:threadId/read', authenticateToken, async (req, res) => {
  try {
    const { threadId } = req.params;
    const hasAccess = await canUserAccessThread(req.user.id, req.user.role, threadId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Từ chối quyền' });
    }

    await run(
      'UPDATE chat_messages SET is_read = 1 WHERE thread_id = ? AND sender_id != ?',
      [threadId, req.user.id]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(threadId).emit('messages_read', { threadId, readerId: req.user.id });
    }

    res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
  } catch (error) {
    console.error('[Chat] Read receipt error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * POST /api/chat/block
 * Chặn người dùng gửi tin nhắn
 */
router.post('/block', authenticateToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId || targetUserId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Mã người dùng cần chặn không hợp lệ' });
    }

    const blockId = `blk-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    await run(
      `INSERT INTO chat_blocks (id, blocker_id, blocked_id)
       VALUES (?, ?, ?)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockId, req.user.id, targetUserId]
    );

    res.json({ success: true, message: 'Đã chặn người dùng thành công' });
  } catch (error) {
    console.error('[Chat] Block error:', error);
    res.status(500).json({ success: false, message: 'Lỗi chặn người dùng' });
  }
});

/**
 * GET /api/chat/blocked
 * Danh sách người dùng bị chặn
 */
router.get('/blocked/list', authenticateToken, async (req, res) => {
  try {
    const rows = await query(
      `SELECT b.blocked_id, u.name, u.email, b.created_at
       FROM chat_blocks b
       JOIN users u ON b.blocked_id = u.id
       WHERE b.blocker_id = ?`,
      [req.user.id]
    );
    res.json({ success: true, blockedUsers: rows });
  } catch (error) {
    console.error('[Chat] Get blocked list error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * DELETE /api/chat/block/:targetUserId
 * Bỏ chặn người dùng
 */
router.delete('/block/:targetUserId', authenticateToken, async (req, res) => {
  try {
    await run(
      'DELETE FROM chat_blocks WHERE blocker_id = ? AND blocked_id = ?',
      [req.user.id, req.params.targetUserId]
    );
    res.json({ success: true, message: 'Đã bỏ chặn người dùng' });
  } catch (error) {
    console.error('[Chat] Unblock error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

export default router;
