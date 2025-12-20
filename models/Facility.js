const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, '施設名を入力してください'],
      trim: true,
    },
    facility_type: {
      type: String,
      enum: ['介護保険施設', '医療施設', '在宅', 'その他'],
      required: [true, '施設種別を選択してください'],
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
    units: {
      type: Number,
    },
    contact_person: {
      name: String,
      phone: String,
      email: String,
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

module.exports = mongoose.model('Facility', facilitySchema);

