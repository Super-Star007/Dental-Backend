const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorRole: { type: String, required: true, trim: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    action: { type: String, required: true, trim: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    targetInternalId: { type: String, default: null, trim: true },
    meta: { type: Object, default: {} },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);


