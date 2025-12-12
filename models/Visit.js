const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema(
  {
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, '患者IDが必要です'],
    },
    scheduled_at: {
      type: Date,
      required: [true, '訪問日時を入力してください'],
    },
    assigned_clinician_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '担当者を選択してください'],
    },
    visit_type: {
      type: String,
      enum: ['診療', '検診', '口腔ケアのみ', 'その他'],
      required: [true, '訪問種別を選択してください'],
    },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    facility_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: [true, '施設IDが必要です'],
    },
    notes: {
      type: String,
      trim: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
visitSchema.index({ scheduled_at: 1 });
visitSchema.index({ patient_id: 1 });
visitSchema.index({ assigned_clinician_id: 1 });
visitSchema.index({ facility_id: 1 });
visitSchema.index({ status: 1 });

module.exports = mongoose.model('Visit', visitSchema);

