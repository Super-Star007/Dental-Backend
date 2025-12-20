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
    patient_number: {
      type: String,
      trim: true,
    },
    care_level: {
      type: String,
      trim: true,
    },
    insurance_info: {
      type: String,
      trim: true,
    },
    care_insurance_info: {
      type: String,
      trim: true,
    },
    insurance_type: {
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
    first_visit_date: {
      type: Date,
    },
    status: {
      type: String,
      trim: true,
    },
    visit_rehab: {
      type: String,
      trim: true,
    },
    visit_destination_category: {
      type: String,
      trim: true,
    },
    visit_destination_facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
    },
    transition_note: {
      type: String,
      trim: true,
    },
    outpatient_last_visit_date: {
      type: Date,
    },
    home_visit_start_date: {
      type: Date,
    },
    palliative_care_start_ym: {
      type: String,
      trim: true,
    },
    home_visit_end_ym: {
      type: String,
      trim: true,
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
    emergency1_phone: {
      type: String,
      trim: true,
    },
    emergency1_note: {
      type: String,
      trim: true,
    },
    emergency2_phone: {
      type: String,
      trim: true,
    },
    emergency2_note: {
      type: String,
      trim: true,
    },
    care_manager_name: {
      type: String,
      trim: true,
    },
    care_manager_phone: {
      type: String,
      trim: true,
    },
    care_manager_office: {
      type: String,
      trim: true,
    },
    key_person_name: {
      type: String,
      trim: true,
    },
    key_person_relation: {
      type: String,
      trim: true,
    },
    key_person_phone: {
      type: String,
      trim: true,
    },
    avatar_image: {
      type: String,
      trim: true,
    },
    insurance_card_image: {
      type: String,
      trim: true,
    },
    care_insurance_card_image: {
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

