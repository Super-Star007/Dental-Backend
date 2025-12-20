const mongoose = require('mongoose');

const hygienistMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, '歯科衛生士名を入力してください'],
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

module.exports = mongoose.model('HygienistMaster', hygienistMasterSchema);


