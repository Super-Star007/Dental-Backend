const mongoose = require('mongoose');

const templateMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'メニュー名を入力してください'],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    sheet_type: {
      type: String,
      trim: true,
    },
    target: {
      type: String,
      trim: true,
    },
    sort_order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TemplateMaster', templateMasterSchema);


