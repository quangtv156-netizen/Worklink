import express from 'express';
import crypto from 'crypto';
import { query, run } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/notifications - lay thong bao cua user hien tai
router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
      [req.user.id]
    );
    const unreadCount = rows.filter(r => !r.is_read).length;
    res.json({ success: true, notifications: rows, unreadCount });
  } catch(e) {
    res.status(500).json({ success: false, message: 'Loi may chu' });
  }
});

// PATCH /api/notifications/read-all - danh dau tat ca da doc
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, message: 'Loi may chu' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, message: 'Loi may chu' });
  }
});

// Helper: tao notification (dung noi bo trong cac route khac)
export async function createNotification({ userId, type, title, body, linkType, linkId }) {
  try {
    const id = `notif-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    await run(
      'INSERT INTO notifications (id, user_id, type, title, body, link_type, link_id) VALUES (?,?,?,?,?,?,?)',
      [id, userId, type, title, body||null, linkType||null, linkId||null]
    );
  } catch(e) {
    console.warn('[Notifications] Failed to create:', e.message);
  }
}

export default router;
