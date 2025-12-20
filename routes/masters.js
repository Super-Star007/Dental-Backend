const express = require('express');
const { body, validationResult } = require('express-validator');
const DentistMaster = require('../models/DentistMaster');
const HygienistMaster = require('../models/HygienistMaster');
const TemplateMaster = require('../models/TemplateMaster');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Utility: build query by role
const buildQueryByRole = (req) => {
  const query = {};
  if (req.user.role === 'clinic_admin') {
    query.created_by = req.user.id;
  }
  return query;
};

// ===== 歯科医師名マスタ =====

// GET /api/masters/dentists
router.get('/dentists', protect, async (req, res) => {
  try {
    const query = buildQueryByRole(req);
    const dentists = await DentistMaster.find(query).sort({ name: 1 });
    res.json({
      success: true,
      count: dentists.length,
      data: dentists,
    });
  } catch (error) {
    console.error('Get dentists master error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '歯科医師マスタの取得に失敗しました。',
    });
  }
});

// POST /api/masters/dentists
router.post(
  '/dentists',
  protect,
  authorize('clinic_admin', 'system_admin', 'admin'),
  [body('name').notEmpty().withMessage('歯科医師名を入力してください')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const dentist = await DentistMaster.create({
        name: req.body.name,
        created_by: req.user.id,
      });

      res.status(201).json({
        success: true,
        message: '歯科医師名を登録しました。',
        data: dentist,
      });
    } catch (error) {
      console.error('Create dentist master error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '歯科医師名の登録に失敗しました。',
      });
    }
  }
);

// DELETE /api/masters/dentists/:id
router.delete('/dentists/:id', protect, async (req, res) => {
  try {
    const dentist = await DentistMaster.findById(req.params.id);
    if (!dentist) {
      return res.status(404).json({
        success: false,
        message: '歯科医師名が見つかりません。',
      });
    }

    if (req.user.role === 'clinic_admin' && dentist.created_by.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'この歯科医師名を削除する権限がありません。',
      });
    }

    await dentist.deleteOne();

    res.json({
      success: true,
      message: '歯科医師名を削除しました。',
    });
  } catch (error) {
    console.error('Delete dentist master error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '歯科医師名の削除に失敗しました。',
    });
  }
});

// ===== 歯科衛生士名マスタ =====

// GET /api/masters/hygienists
router.get('/hygienists', protect, async (req, res) => {
  try {
    const query = buildQueryByRole(req);
    const hygienists = await HygienistMaster.find(query).sort({ name: 1 });
    res.json({
      success: true,
      count: hygienists.length,
      data: hygienists,
    });
  } catch (error) {
    console.error('Get hygienists master error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '歯科衛生士マスタの取得に失敗しました。',
    });
  }
});

// POST /api/masters/hygienists
router.post(
  '/hygienists',
  protect,
  authorize('clinic_admin', 'system_admin', 'admin'),
  [body('name').notEmpty().withMessage('歯科衛生士名を入力してください')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const hygienist = await HygienistMaster.create({
        name: req.body.name,
        created_by: req.user.id,
      });

      res.status(201).json({
        success: true,
        message: '歯科衛生士名を登録しました。',
        data: hygienist,
      });
    } catch (error) {
      console.error('Create hygienist master error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '歯科衛生士名の登録に失敗しました。',
      });
    }
  }
);

// DELETE /api/masters/hygienists/:id
router.delete('/hygienists/:id', protect, async (req, res) => {
  try {
    const hygienist = await HygienistMaster.findById(req.params.id);
    if (!hygienist) {
      return res.status(404).json({
        success: false,
        message: '歯科衛生士名が見つかりません。',
      });
    }

    if (req.user.role === 'clinic_admin' && hygienist.created_by.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'この歯科衛生士名を削除する権限がありません。',
      });
    }

    await hygienist.deleteOne();

    res.json({
      success: true,
      message: '歯科衛生士名を削除しました。',
    });
  } catch (error) {
    console.error('Delete hygienist master error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '歯科衛生士名の削除に失敗しました。',
    });
  }
});

// ===== プルダウンメニュー（文書用テンプレート） =====

// GET /api/masters/templates
router.get('/templates', protect, async (req, res) => {
  try {
    const query = buildQueryByRole(req);
    const templates = await TemplateMaster.find(query).sort({ sort_order: 1, name: 1 });
    res.json({
      success: true,
      count: templates.length,
      data: templates,
    });
  } catch (error) {
    console.error('Get templates master error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'プルダウンメニューマスタの取得に失敗しました。',
    });
  }
});

// POST /api/masters/templates
router.post(
  '/templates',
  protect,
  authorize('clinic_admin', 'system_admin', 'admin'),
  [body('name').notEmpty().withMessage('メニュー名を入力してください')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const template = await TemplateMaster.create({
        name: req.body.name,
        category: req.body.category || '',
        sheet_type: req.body.sheet_type || '',
        target: req.body.target || '',
        sort_order:
          typeof req.body.sort_order === 'number'
            ? req.body.sort_order
            : parseInt(req.body.sort_order, 10) || 0,
        active: typeof req.body.active === 'boolean' ? req.body.active : req.body.active !== 'false',
        notes: req.body.notes || '',
        created_by: req.user.id,
      });

      res.status(201).json({
        success: true,
        message: 'プルダウンメニューを登録しました。',
        data: template,
      });
    } catch (error) {
      console.error('Create template master error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'プルダウンメニューの登録に失敗しました。',
      });
    }
  }
);

// DELETE /api/masters/templates/:id
router.delete('/templates/:id', protect, async (req, res) => {
  try {
    const template = await TemplateMaster.findById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'プルダウンメニューが見つかりません。',
      });
    }

    if (req.user.role === 'clinic_admin' && template.created_by.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'このプルダウンメニューを削除する権限がありません。',
      });
    }

    await template.deleteOne();

    res.json({
      success: true,
      message: 'プルダウンメニューを削除しました。',
    });
  } catch (error) {
    console.error('Delete template master error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'プルダウンメニューの削除に失敗しました。',
    });
  }
});

module.exports = router;


