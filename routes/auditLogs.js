const express = require('express');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/audit-logs
// @desc    List audit logs (system_admin/admin only)
// @access  Private
router.get('/', protect, authorize('system_admin', 'admin'), async (req, res) => {
  try {
    const { targetUserId, targetInternalId, action, limit } = req.query;

    const query = {};
    if (targetUserId) query.targetUserId = targetUserId;
    if (targetInternalId) query.targetInternalId = targetInternalId;
    if (action) query.action = action;

    const take = Math.min(parseInt(limit || '20', 10) || 20, 200);

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(take)
      .lean();

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。',
    });
  }
});

// @route   DELETE /api/audit-logs
// @desc    Permanently delete audit logs (system_admin/admin only)
// @access  Private
router.delete('/', protect, authorize('system_admin', 'admin'), async (req, res) => {
  try {
    const { targetUserId, targetInternalId, action } = req.query;
    if (!targetUserId && !targetInternalId) {
      return res.status(400).json({
        success: false,
        message: 'targetUserId または targetInternalId を指定してください。',
      });
    }

    const query = {};
    if (targetUserId) query.targetUserId = targetUserId;
    if (targetInternalId) query.targetInternalId = targetInternalId;
    if (action) query.action = action;

    const result = await AuditLog.deleteMany(query);
    res.json({
      success: true,
      message: 'ログを完全削除しました。',
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    console.error('Delete audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。',
    });
  }
});

module.exports = router;


