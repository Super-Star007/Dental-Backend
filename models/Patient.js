const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, '患者名を入力してください'],
      trim: true,
    },
    name_kana: {
      type: String,
      trim: true,
    },
    facility_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: [true, '施設IDが必要です'],
    },
    room: {
      type: String,
      trim: true,
    },
    floor: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ['男', '女', 'その他'],
    },
    date_of_birth: {
      type: Date,
    },
    address: {
      postal_code: String,
      address1: String,
      address2: String,
    },
    phone: {
      type: String,
      trim: true,
    },
    fax: {
      type: String,
      trim: true,
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

module.exports = mongoose.model('Patient', patientSchema);

