const express = require('express');
const { body, validationResult } = require('express-validator');
const Patient = require('../models/Patient');
const Facility = require('../models/Facility');
const uploadPatientDocs = require('../middleware/uploadPatientDocs');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/patients
// @desc    Get all patients
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { facility_id, name } = req.query;
    const query = {};

    // Multi-tenant: clinic_admin sees only its own patients
    if (req.user.role === 'clinic_admin') {
      query.created_by = req.user.id;
    }

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

    if (req.user.role === 'clinic_admin' && patient.created_by.toString() !== req.user.id) {
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

      // Ensure the facility belongs to the clinic for clinic_admin
      if (req.user.role === 'clinic_admin') {
        const facility = await Facility.findById(req.body.facility_id);
        if (!facility || facility.created_by.toString() !== req.user.id) {
          return res.status(400).json({
            success: false,
            message: '指定した施設が見つかりません（または権限がありません）。',
          });
        }
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

// @route   POST /api/patients/:id/upload-card
// @desc    Upload avatar / insurance / care insurance card image
// @access  Private
router.post('/:id/upload-card', protect, uploadPatientDocs.single('image'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: '患者が見つかりません。',
      });
    }

    // Multi-tenant guard
    if (req.user.role === 'clinic_admin' && patient.created_by.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'この患者に対する操作権限がありません。',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '画像ファイルが送信されていません。',
      });
    }

    const type = req.body.type;
    const relativePath = `/uploads/patients/${req.file.filename}`;

    if (type === 'avatar') {
      patient.avatar_image = relativePath;
    } else if (type === 'insurance') {
      patient.insurance_card_image = relativePath;
    } else if (type === 'care_insurance') {
      patient.care_insurance_card_image = relativePath;
    } else {
      return res.status(400).json({
        success: false,
        message: 'type は avatar, insurance または care_insurance を指定してください。',
      });
    }

    await patient.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: '画像をアップロードしました。',
      path: relativePath,
    });
  } catch (error) {
    console.error('Upload patient card error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '画像のアップロードに失敗しました。',
    });
  }
});

// @route   PUT /api/patients/:id
// @desc    Update patient basic info
// @access  Private
router.put(
  '/:id',
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

      const patient = await Patient.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: '患者が見つかりません。',
        });
      }

      // Multi-tenant guard
      if (req.user.role === 'clinic_admin' && patient.created_by.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'この患者に対する操作権限がありません。',
        });
      }

      // Only update allowed fields; keep existing card images unless別途アップロード
      const updatableFields = [
        'name',
        'name_kana',
        'patient_number',
        'care_level',
        'insurance_info',
        'care_insurance_info',
        'facility_id',
        'room',
        'floor',
        'gender',
        'date_of_birth',
        'first_visit_date',
        'status',
        'visit_rehab',
        'address',
        'phone',
        'fax',
        'emergency1_phone',
        'emergency1_note',
        'emergency2_phone',
        'emergency2_note',
        'notes',
      ];

      updatableFields.forEach((field) => {
        if (typeof req.body[field] !== 'undefined') {
          patient[field] = req.body[field];
        }
      });

      patient.updated_by = req.user.id;

      await patient.save();

      const populated = await Patient.findById(patient._id).populate('facility_id', 'name');

      res.json({
        success: true,
        message: '患者情報を更新しました。',
        data: populated,
      });
    } catch (error) {
      console.error('Update patient error:', error);
      res.status(500).json({
        success: false,
        message: error.message || '患者情報の更新に失敗しました。',
      });
    }
  }
);

// @route   DELETE /api/patients/:id
// @desc    Delete patient
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: '患者が見つかりません。',
      });
    }

    // Multi-tenant guard
    if (req.user.role === 'clinic_admin' && patient.created_by.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'この患者に対する操作権限がありません。',
      });
    }

    await patient.deleteOne();

    res.json({
      success: true,
      message: '患者情報を削除しました。',
    });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '患者情報の削除に失敗しました。',
    });
  }
});

module.exports = router;

