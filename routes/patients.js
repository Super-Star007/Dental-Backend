const express = require('express');
const { body, validationResult } = require('express-validator');
const Patient = require('../models/Patient');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/patients
// @desc    Get all patients
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { facility_id, name } = req.query;
    const query = {};

    if (facility_id) query.facility_id = facility_id;
    if (name) {
      query.$or = [
        { name: { $regex: name, $options: 'i' } },
        { name_kana: { $regex: name, $options: 'i' } },
      ];
    }

    const patients = await Patient.find(query)
      .populate('facility_id', 'name')
      .sort({ name: 1 });

    res.json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '患者データの取得に失敗しました。',
    });
  }
});

// @route   GET /api/patients/:id
// @desc    Get single patient
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).populate('facility_id');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: '患者が見つかりません。',
      });
    }

    res.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '患者データの取得に失敗しました。',
    });
  }
});

// @route   POST /api/patients
// @desc    Create new patient
// @access  Private
router.post(
  '/',
  protect,
  [
    body('name').notEmpty().withMessage('患者名を入力してください'),
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

      const patient = await Patient.create({
        ...req.body,
        created_by: req.user.id,
      });

      const populatedPatient = await Patient.findById(patient._id).populate('facility_id');

      res.status(201).json({
        success: true,
        message: '患者を登録しました。',
        data: populatedPatient,
      });
    } catch (error) {
      console.error('Create patient error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '患者の登録に失敗しました。',
      });
    }
  }
);

module.exports = router;

