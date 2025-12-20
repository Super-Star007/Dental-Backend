const mongoose = require('mongoose');

const dentistMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, '歯科医師名を入力してください'],
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

module.exports = mongoose.model('DentistMaster', dentistMasterSchema);


