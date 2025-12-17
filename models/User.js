const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    // Immutable internal ID for tracking (does not change even if login/email changes)
    internalId: {
      type: String,
      unique: true,
      default: () => crypto.randomUUID(),
      immutable: true,
      index: true,
    },
    // Login ID (separate from contact email). Can be changed; internalId remains stable.
    loginId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, '名前を入力してください'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'メールアドレスを入力してください'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        '有効なメールアドレスを入力してください',
      ],
    },
    password: {
      type: String,
      required: false, // Password is optional for OAuth users
      validate: {
        validator: function(value) {
          // If password is provided, it must be at least 6 characters
          if (value && value.length > 0) {
            if (value.length < 6) {
              return false;
            }
          }
          // Password is required only if user is not using OAuth
          if (!this.googleId && !this.facebookId) {
            // For non-OAuth users, password is required
            return value && value.length >= 6;
          }
          // OAuth users don't need password
          return true;
        },
        message: 'パスワードは6文字以上で入力してください',
      },
      select: false, // Don't return password by default
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    facebookId: {
      type: String,
      sparse: true,
      unique: true,
    },
    role: {
      type: String,
      // Keep existing roles for backwards compatibility; add new roles for the new policy.
      enum: ['system_admin', 'clinic_admin', 'admin', 'dentist', 'hygienist', 'staff', 'billing'],
      default: 'staff',
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastLoginIp: {
      type: String,
      default: null,
      trim: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving (only if password exists and is modified)
userSchema.pre('save', async function (next) {
  // Default loginId to email when missing (helps migration / existing flows)
  if (!this.loginId && this.email) {
    this.loginId = this.email;
  }

  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate password reset token
userSchema.methods.getResetPasswordToken = function () {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(20).toString('hex');

  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Token expires in 30 minutes (development) or 10 minutes (production)
  const expirationTime = process.env.NODE_ENV === 'production' 
    ? 10 * 60 * 1000  // 10 minutes for production
    : 30 * 60 * 1000; // 30 minutes for development
  this.resetPasswordExpire = Date.now() + expirationTime;

  return resetToken;
};

module.exports = mongoose.model('User', userSchema);

