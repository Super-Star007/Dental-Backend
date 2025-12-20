const express = require('express');
const { body, validationResult } = require('express-validator');
const Facility = require('../models/Facility');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/facilities
// @desc    Get all facilities
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { name } = req.query;
    const query = {};

    // Multi-tenant: clinic_admin sees only its own facilities
    if (req.user.role === 'clinic_admin') {
      query.created_by = req.user.id;
    }

    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }

    const facilities = await Facility.find(query).sort({ name: 1 });

    res.json({
      success: true,
      count: facilities.length,
      data: facilities,
    });
  } catch (error) {
    console.error('Get facilities error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '施設データの取得に失敗しました。',
    });
  }
});

// @route   GET /api/facilities/:id
// @desc    Get single facility
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id);

    if (!facility) {
      return res.status(404).json({
        success: false,
        message: '施設が見つかりません。',
      });
    }

    // Multi-tenant access control
    if (req.user.role === 'clinic_admin' && facility.created_by.toString() !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: '施設が見つかりません。',
      });
    }

    res.json({
      success: true,
      data: facility,
    });
  } catch (error) {
    console.error('Get facility error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '施設データの取得に失敗しました。',
    });
  }
});

// @route   POST /api/facilities
// @desc    Create new facility
// @access  Private (clinic_admin / system_admin / admin)
router.post(
  '/',
  protect,
  authorize('clinic_admin', 'system_admin', 'admin'),
  [
    body('name').notEmpty().withMessage('施設名を入力してください'),
    body('facility_type')
      .isIn(['介護保険施設', '医療施設', '在宅', 'その他'])
      .withMessage('有効な施設種別を選択してください'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const facility = await Facility.create({
        ...req.body,
        created_by: req.user.id,
      });

      res.status(201).json({
        success: true,
        message: '施設を登録しました。',
        data: facility,
      });
    } catch (error) {
      console.error('Create facility error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '施設の登録に失敗しました。',
      });
    }
  }
);

// @route   PUT /api/facilities/:id
// @desc    Update facility
// @access  Private
router.put(
  '/:id',
  protect,
  authorize('clinic_admin', 'system_admin', 'admin'),
  [
    body('name').notEmpty().withMessage('施設名を入力してください'),
    body('facility_type')
      .isIn(['介護保険施設', '医療施設', '在宅', 'その他'])
      .withMessage('有効な施設種別を選択してください'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const facility = await Facility.findById(req.params.id);
      if (!facility) {
        return res.status(404).json({
          success: false,
          message: '施設が見つかりません。',
        });
      }

      if (req.user.role === 'clinic_admin' && facility.created_by.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'この施設を編集する権限がありません。',
        });
      }

      facility.name = req.body.name;
      facility.facility_type = req.body.facility_type;
      facility.address = req.body.address || facility.address;
      facility.phone = req.body.phone || '';
      facility.fax = req.body.fax || '';
      facility.units = typeof req.body.units === 'number'
        ? req.body.units
        : parseInt(req.body.units, 10) || undefined;

      await facility.save();

      res.json({
        success: true,
        message: '施設を更新しました。',
        data: facility,
      });
    } catch (error) {
      console.error('Update facility error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '施設の更新に失敗しました。',
      });
    }
  }
);

// @route   DELETE /api/facilities/:id
// @desc    Delete facility
// @access  Private
router.delete('/:id', protect, authorize('clinic_admin', 'system_admin', 'admin'), async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id);
    if (!facility) {
      return res.status(404).json({
        success: false,
        message: '施設が見つかりません。',
      });
    }

    if (req.user.role === 'clinic_admin' && facility.created_by.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'この施設を削除する権限がありません。',
      });
    }

    await facility.deleteOne();

    res.json({
      success: true,
      message: '施設を削除しました。',
    });
  } catch (error) {
    console.error('Delete facility error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '施設の削除に失敗しました。',
    });
  }
});

module.exports = router;

