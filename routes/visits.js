const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const Facility = require('../models/Facility');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/visits
// @desc    Get all visits with filters
// @access  Private
router.get(
  '/',
  protect,
  [
    query('date').optional().isISO8601().withMessage('有効な日付形式を入力してください'),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('patient_id').optional().isMongoId(),
    query('facility_id').optional().isMongoId(),
    query('assigned_clinician_id').optional().isMongoId(),
    query('status').optional().isIn(['scheduled', 'confirmed', 'completed', 'cancelled']),
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

      const {
        date,
        startDate,
        endDate,
        patient_id,
        facility_id,
        assigned_clinician_id,
        status,
        patient_name,
        facility_name,
      } = req.query;

      // Build query
      const query = {};

      // Date filters
      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        query.scheduled_at = { $gte: startOfDay, $lte: endOfDay };
      } else if (startDate || endDate) {
        query.scheduled_at = {};
        if (startDate) {
          query.scheduled_at.$gte = new Date(startDate);
        }
        if (endDate) {
          query.scheduled_at.$lte = new Date(endDate);
        }
      }

      if (patient_id) query.patient_id = patient_id;
      if (facility_id) query.facility_id = facility_id;
      if (assigned_clinician_id) query.assigned_clinician_id = assigned_clinician_id;
      if (status) query.status = status;

      let visits = await Visit.find(query)
        .populate('patient_id', 'name name_kana room floor')
        .populate('assigned_clinician_id', 'name role')
        .populate('facility_id', 'name')
        .sort({ scheduled_at: 1 });

      // Filter by patient name if provided
      if (patient_name) {
        visits = visits.filter((visit) => {
          const patient = visit.patient_id;
          if (!patient) return false;
          return (
            patient.name?.includes(patient_name) ||
            patient.name_kana?.includes(patient_name)
          );
        });
      }

      // Filter by facility name if provided
      if (facility_name) {
        visits = visits.filter((visit) => {
          const facility = visit.facility_id;
          if (!facility) return false;
          return facility.name?.includes(facility_name);
        });
      }

      res.json({
        success: true,
        count: visits.length,
        data: visits,
      });
    } catch (error) {
      console.error('Get visits error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '訪問スケジュールの取得に失敗しました。',
      });
    }
  }
);

// @route   GET /api/visits/today
// @desc    Get today's visits
// @access  Private
router.get('/today', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const visits = await Visit.find({
      scheduled_at: { $gte: today, $lt: tomorrow },
      status: { $ne: 'cancelled' },
    })
      .populate('patient_id', 'name name_kana room floor')
      .populate('assigned_clinician_id', 'name role')
      .populate('facility_id', 'name')
      .sort({ scheduled_at: 1 });

    res.json({
      success: true,
      count: visits.length,
      data: visits,
    });
  } catch (error) {
    console.error('Get today visits error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '本日の訪問スケジュールの取得に失敗しました。',
    });
  }
});

// @route   GET /api/visits/:id
// @desc    Get single visit
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate('patient_id')
      .populate('assigned_clinician_id', 'name role email')
      .populate('facility_id')
      .populate('created_by', 'name')
      .populate('updated_by', 'name');

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: '訪問スケジュールが見つかりません。',
      });
    }

    res.json({
      success: true,
      data: visit,
    });
  } catch (error) {
    console.error('Get visit error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '訪問スケジュールの取得に失敗しました。',
    });
  }
});

// @route   POST /api/visits
// @desc    Create new visit
// @access  Private (dentist, hygienist, admin only)
router.post(
  '/',
  protect,
  authorize('admin', 'dentist', 'hygienist'),
  [
    body('patient_id').notEmpty().withMessage('患者を選択してください'),
    body('scheduled_at').notEmpty().withMessage('訪問日時を入力してください'),
    body('assigned_clinician_id').notEmpty().withMessage('担当者を選択してください'),
    body('visit_type')
      .isIn(['診療', '検診', '口腔ケアのみ', 'その他'])
      .withMessage('有効な訪問種別を選択してください'),
    body('facility_id').notEmpty().withMessage('施設を選択してください'),
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

      const {
        patient_id,
        scheduled_at,
        assigned_clinician_id,
        visit_type,
        facility_id,
        notes,
        status,
      } = req.body;

      const visit = await Visit.create({
        patient_id,
        scheduled_at: new Date(scheduled_at),
        assigned_clinician_id,
        visit_type,
        facility_id,
        notes,
        status: status || 'scheduled',
        created_by: req.user.id,
      });

      const populatedVisit = await Visit.findById(visit._id)
        .populate('patient_id', 'name name_kana room floor')
        .populate('assigned_clinician_id', 'name role')
        .populate('facility_id', 'name');

      res.status(201).json({
        success: true,
        message: '訪問スケジュールを作成しました。',
        data: populatedVisit,
      });
    } catch (error) {
      console.error('Create visit error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '訪問スケジュールの作成に失敗しました。',
      });
    }
  }
);

// @route   PUT /api/visits/:id
// @desc    Update visit
// @access  Private (dentist, hygienist, admin only)
router.put(
  '/:id',
  protect,
  authorize('admin', 'dentist', 'hygienist'),
  [
    body('scheduled_at').optional().notEmpty().withMessage('訪問日時を入力してください'),
    body('visit_type')
      .optional()
      .isIn(['診療', '検診', '口腔ケアのみ', 'その他'])
      .withMessage('有効な訪問種別を選択してください'),
    body('status')
      .optional()
      .isIn(['scheduled', 'confirmed', 'completed', 'cancelled'])
      .withMessage('有効なステータスを選択してください'),
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

      let visit = await Visit.findById(req.params.id);

      if (!visit) {
        return res.status(404).json({
          success: false,
          message: '訪問スケジュールが見つかりません。',
        });
      }

      const {
        patient_id,
        scheduled_at,
        assigned_clinician_id,
        visit_type,
        facility_id,
        notes,
        status,
      } = req.body;

      if (patient_id) visit.patient_id = patient_id;
      if (scheduled_at) visit.scheduled_at = new Date(scheduled_at);
      if (assigned_clinician_id) visit.assigned_clinician_id = assigned_clinician_id;
      if (visit_type) visit.visit_type = visit_type;
      if (facility_id) visit.facility_id = facility_id;
      if (notes !== undefined) visit.notes = notes;
      if (status) visit.status = status;
      visit.updated_by = req.user.id;

      await visit.save();

      const populatedVisit = await Visit.findById(visit._id)
        .populate('patient_id', 'name name_kana room floor')
        .populate('assigned_clinician_id', 'name role')
        .populate('facility_id', 'name');

      res.json({
        success: true,
        message: '訪問スケジュールを更新しました。',
        data: populatedVisit,
      });
    } catch (error) {
      console.error('Update visit error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '訪問スケジュールの更新に失敗しました。',
      });
    }
  }
);

// @route   DELETE /api/visits/:id
// @desc    Delete visit
// @access  Private (admin, dentist, hygienist only)
router.delete('/:id', protect, authorize('admin', 'dentist', 'hygienist'), async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: '訪問スケジュールが見つかりません。',
      });
    }

    await visit.deleteOne();

    res.json({
      success: true,
      message: '訪問スケジュールを削除しました。',
    });
  } catch (error) {
    console.error('Delete visit error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '訪問スケジュールの削除に失敗しました。',
    });
  }
});

module.exports = router;

