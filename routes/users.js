const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');
const AuditLog = require('../models/AuditLog');
const crypto = require('crypto');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (Admin only) or filter by role
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { role } = req.query;
    const query = {};

    // Policy: only system_admin/admin can list clinics/users
    const isSystemAdmin = req.user.role === 'system_admin' || req.user.role === 'admin';
    if (!isSystemAdmin) {
      return res.status(403).json({
        success: false,
        message: 'この操作を実行する権限がありません。',
      });
    }

    // Optional role filter
    if (role) {
      const roles = role.split(',').map((r) => r.trim()).filter(Boolean);
      if (roles.length > 0) {
        query.role = { $in: roles };
      }
    }

    const users = await User.find(query).select('-password').sort({ name: 1 });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。',
    });
  }
});

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません。',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。',
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user detail (system_admin/admin only)
// @access  Private
router.get('/:id', protect, authorize('system_admin', 'admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '対象アカウントが見つかりません。',
      });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user detail error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。',
    });
  }
});

// @route   POST /api/users/upload-avatar
// @desc    Upload avatar image
// @access  Private
router.post('/upload-avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '画像ファイルを選択してください。',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      // Delete uploaded file if user not found
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません。',
      });
    }

    // Delete old avatar file if exists
    if (user.avatar && user.avatar.startsWith('/uploads/')) {
      const oldFilePath = path.join(__dirname, '..', user.avatar);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Update user avatar
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    user.avatar = avatarPath;
    await user.save();

    // Verify file exists
    const filePath = path.join(__dirname, '..', avatarPath);
    if (!fs.existsSync(filePath)) {
      console.error('Uploaded file not found at:', filePath);
      return res.status(500).json({
        success: false,
        message: 'ファイルの保存に失敗しました。',
      });
    }

    console.log('Avatar uploaded successfully:', {
      filename: req.file.filename,
      path: avatarPath,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    res.json({
      success: true,
      message: 'アバター画像がアップロードされました。',
      avatar: user.avatar,
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    // Delete uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message || 'アバター画像のアップロードに失敗しました。',
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put(
  '/profile',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('名前を入力してください'),
    body('loginId')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 3 })
      .withMessage('ログインIDは3文字以上で入力してください'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('有効なメールアドレスを入力してください'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('role')
      .optional()
      .isIn(['system_admin', 'clinic_admin', 'admin', 'dentist', 'hygienist', 'staff', 'billing'])
      .withMessage('有効な役割を選択してください'),
    body('oldPassword')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (value && value.trim().length > 0 && value.trim().length < 6) {
          throw new Error('旧パスワードは6文字以上で入力してください');
        }
        return true;
      }),
    body('newPassword')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (value && value.trim().length > 0 && value.trim().length < 6) {
          throw new Error('新パスワードは6文字以上で入力してください');
        }
        return true;
      }),
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

      const { name, email, loginId, phone, address, role, avatar, oldPassword, newPassword, confirmPassword } =
        req.body;
      // Get user with password field included
      const user = await User.findById(req.user.id).select('+password');
      
      // Store original password to check if it changed
      const originalPassword = user.password;
      const originalName = user.name;
      const originalEmail = user.email;
      const originalLoginId = user.loginId;

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません。',
        });
      }

      // Check if email is being changed and if it's already taken
      if (email && email !== user.email) {
        const emailExists = await User.findOne({ email });
        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: 'このメールアドレスは既に使用されています。',
          });
        }
        user.email = email;
      }

      // Check if loginId is being changed and if it's already taken
      if (loginId && loginId !== user.loginId) {
        const loginIdExists = await User.findOne({ loginId });
        if (loginIdExists) {
          return res.status(400).json({
            success: false,
            message: 'このログインIDは既に使用されています。',
          });
        }
        user.loginId = loginId;
      }

      // Handle password change
      // Only process password change if at least one password field is provided and not empty
      const hasOldPassword = oldPassword && oldPassword.trim().length > 0;
      const hasNewPassword = newPassword && newPassword.trim().length > 0;
      const hasConfirmPassword = confirmPassword && confirmPassword.trim().length > 0;
      
      if (hasOldPassword || hasNewPassword || hasConfirmPassword) {
        // If any password field is provided, all must be provided
        if (!hasOldPassword || !hasNewPassword || !hasConfirmPassword) {
          return res.status(400).json({
            success: false,
            message: 'パスワード変更には旧パスワード、新パスワード、確認パスワードの全てを入力してください。',
          });
        }

        const oldPwd = oldPassword.trim();
        const newPwd = newPassword.trim();
        const confirmPwd = confirmPassword.trim();

        if (newPwd !== confirmPwd) {
          return res.status(400).json({
            success: false,
            message: '新パスワードが一致しません。',
          });
        }

        // Check if user has a password (for OAuth users, they might not have one)
        const userHasPassword = user.password || (!user.googleId && !user.facebookId);
        
        if (userHasPassword) {
          // Verify old password
          const isMatch = await user.matchPassword(oldPwd);
          if (!isMatch) {
            return res.status(400).json({
              success: false,
              message: '旧パスワードが正しくありません。',
            });
          }
        }
        // For OAuth users without password, allow setting a new password without old password verification

        // Set new password
        user.password = newPwd;
        // Clear "must change password" once clinic sets a new password successfully
        user.mustChangePassword = false;
        // Mark password as modified to ensure pre-save hook runs
        user.markModified('password');
      }

      // Update fields
      if (name && name.trim()) {
        user.name = name.trim();
      }
      if (phone !== undefined) {
        user.phone = phone ? phone.trim() : '';
      }
      if (address !== undefined) {
        user.address = address ? address.trim() : '';
      }
      // Update avatar if provided (should be a server path like /uploads/avatars/...)
      if (avatar && avatar.startsWith('/uploads/')) {
        user.avatar = avatar;
      }
      if (role && (req.user.role === 'admin' || req.user.role === 'system_admin')) {
        // Only system_admin/admin can change roles (even on self profile)
        user.role = role;
      } else if (role && !(req.user.role === 'admin' || req.user.role === 'system_admin')) {
        return res.status(403).json({
          success: false,
          message: '役割の変更は管理者のみ可能です。',
        });
      }

      // Save user
      // Password modification is already marked in the password change section above
      // Double-check that password is marked as modified if it was changed
      const passwordWasChanged = hasOldPassword || hasNewPassword || hasConfirmPassword;
      if (passwordWasChanged && !user.isModified('password')) {
        user.markModified('password');
      }
      
      await user.save();

      // Audit: if clinic changed account info, notify via AuditLog (for admin notifications)
      try {
        const ip =
          (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
          req.ip ||
          req.socket?.remoteAddress ||
          null;
        const userAgent = req.headers['user-agent'] || null;

        const changedFields = [];
        if (originalName !== user.name) changedFields.push('name');
        if (originalEmail !== user.email) changedFields.push('email');
        if (originalLoginId !== user.loginId) changedFields.push('loginId');

        const passwordWasChanged = hasOldPassword || hasNewPassword || hasConfirmPassword;

        if (req.user.role === 'clinic_admin') {
          if (changedFields.length > 0) {
            await AuditLog.create({
              actorRole: req.user.role,
              actorId: req.user._id,
              action: 'clinic_profile_updated',
              targetUserId: req.user._id,
              targetInternalId: user.internalId,
              meta: {
                loginId: user.loginId,
                email: user.email,
                changedFields,
                oldLoginId: originalLoginId,
                ip,
                userAgent,
              },
            });
          }

          if (passwordWasChanged) {
            await AuditLog.create({
              actorRole: req.user.role,
              actorId: req.user._id,
              action: 'clinic_password_changed',
              targetUserId: req.user._id,
              targetInternalId: user.internalId,
              meta: {
                loginId: user.loginId,
                email: user.email,
                ip,
                userAgent,
              },
            });
          }
        }
      } catch (e) {
        // Do not fail profile update on audit failure
        console.error('AuditLog (clinic change) failed:', e.message);
      }
      
      // Log password change for debugging
      if (passwordWasChanged) {
        console.log('Password change completed:', {
          userId: user._id.toString(),
          passwordModified: user.isModified('password'),
          hasPassword: !!user.password,
        });
      }

      res.json({
        success: true,
        message: 'プロフィールが更新されました。',
        user: {
          id: user._id,
          internalId: user.internalId,
          name: user.name,
          email: user.email,
          loginId: user.loginId,
          role: user.role,
          phone: user.phone,
          address: user.address,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      console.error('Update profile error:', error);
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = {};
        Object.keys(error.errors).forEach((key) => {
          validationErrors[key] = error.errors[key].message;
        });
        return res.status(400).json({
          success: false,
          message: 'バリデーションエラーが発生しました。',
          errors: Object.values(validationErrors),
        });
      }

      // Handle duplicate key errors (e.g., email already exists)
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'このメールアドレスは既に使用されています。',
        });
      }

      // Return detailed error in development, generic in production
      res.status(500).json({
        success: false,
        message: 'サーバーエラーが発生しました。',
        ...(process.env.NODE_ENV !== 'production' && { 
          error: error.message,
          stack: error.stack 
        }),
      });
    }
  }
);

// @route   PUT /api/users/:id/status
// @desc    Suspend / resume clinic admin account (system_admin/admin only)
// @access  Private
router.put('/:id/status', protect, authorize('system_admin', 'admin'), async (req, res) => {
  try {
    const { status } = req.body; // 'active' | 'suspended'
    if (!status || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status は active または suspended を指定してください。',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user || user.deletedAt) {
      return res.status(404).json({
        success: false,
        message: '対象アカウントが見つかりません。',
      });
    }

    // Policy: status operations are for clinic_admin accounts
    if (user.role !== 'clinic_admin') {
      return res.status(400).json({
        success: false,
        message: 'この操作は clinic_admin アカウントにのみ適用できます。',
      });
    }

    const nextIsActive = status === 'active';
    user.isActive = nextIsActive;
    await user.save({ validateBeforeSave: false });

    // Audit
    try {
      await AuditLog.create({
        actorRole: req.user.role,
        actorId: req.user._id,
        action: nextIsActive ? 'clinic_account_resumed' : 'clinic_account_suspended',
        targetUserId: user._id,
        targetInternalId: user.internalId,
        meta: { status },
      });
    } catch (e) {
      console.error('AuditLog create failed:', e.message);
    }

    res.json({
      success: true,
      message: nextIsActive ? 'アカウントを再開しました。' : 'アカウントを停止しました。',
      user: {
        id: user._id,
        internalId: user.internalId,
        name: user.name,
        email: user.email,
        loginId: user.loginId,
        role: user.role,
        isActive: user.isActive,
        deletedAt: user.deletedAt,
      },
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。',
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Logical delete clinic admin account (system_admin/admin only)
// @access  Private
router.delete('/:id', protect, authorize('system_admin', 'admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.deletedAt) {
      return res.status(404).json({
        success: false,
        message: '対象アカウントが見つかりません。',
      });
    }

    if (user.role !== 'clinic_admin') {
      return res.status(400).json({
        success: false,
        message: 'この操作は clinic_admin アカウントにのみ適用できます。',
      });
    }

    user.deletedAt = new Date();
    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    // Audit
    try {
      await AuditLog.create({
        actorRole: req.user.role,
        actorId: req.user._id,
        action: 'clinic_account_deleted',
        targetUserId: user._id,
        targetInternalId: user.internalId,
        meta: {},
      });
    } catch (e) {
      console.error('AuditLog create failed:', e.message);
    }

    res.json({
      success: true,
      message: 'アカウントを削除（論理削除）しました。',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。',
    });
  }
});

// @route   DELETE /api/users/:id/hard
// @desc    Permanently delete clinic admin account AND purge related audit logs (system_admin/admin only)
// @access  Private
router.delete('/:id/hard', protect, authorize('system_admin', 'admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '対象アカウントが見つかりません。',
      });
    }

    if (user.role !== 'clinic_admin') {
      return res.status(400).json({
        success: false,
        message: 'この操作は clinic_admin アカウントにのみ適用できます。',
      });
    }

    // Safety: require logical delete first
    if (!user.deletedAt) {
      return res.status(400).json({
        success: false,
        message: '先に「削除（論理削除）」を実行してください。完全削除はその後に可能です。',
      });
    }

    const internalId = user.internalId;

    // Purge logs related to this clinic (both as actor and as target)
    await AuditLog.deleteMany({
      $or: [
        { targetUserId: user._id },
        { actorId: user._id },
        ...(internalId ? [{ targetInternalId: internalId }] : []),
      ],
    });

    // Permanently remove user
    await User.deleteOne({ _id: user._id });

    res.json({
      success: true,
      message: 'アカウントとログを完全削除しました。',
    });
  } catch (error) {
    console.error('Hard delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。',
    });
  }
});

// @route   POST /api/users/:id/reissue-password
// @desc    Reissue a temporary password (returns plaintext ONCE) for a clinic_admin (system_admin/admin only)
// @access  Private
router.post('/:id/reissue-password', protect, authorize('system_admin', 'admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('+password');
    if (!user || user.deletedAt) {
      return res.status(404).json({
        success: false,
        message: '対象アカウントが見つかりません。',
      });
    }
    if (user.role !== 'clinic_admin') {
      return res.status(400).json({
        success: false,
        message: 'この操作は clinic_admin アカウントにのみ適用できます。',
      });
    }

    // Generate temp password (readable, no ambiguous chars)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';
    let tempPassword = '';
    for (let i = 0; i < 12; i += 1) {
      tempPassword += chars[Math.floor(Math.random() * chars.length)];
    }

    user.password = tempPassword;
    user.mustChangePassword = true;
    user.isActive = true;
    user.deletedAt = null;
    user.markModified('password');
    await user.save();

    // Audit
    try {
      const ip =
        (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
        req.ip ||
        req.socket?.remoteAddress ||
        null;
      const userAgent = req.headers['user-agent'] || null;

      await AuditLog.create({
        actorRole: req.user.role,
        actorId: req.user._id,
        action: 'clinic_password_reissued',
        targetUserId: user._id,
        targetInternalId: user.internalId,
        meta: { loginId: user.loginId, email: user.email, ip, userAgent },
      });
    } catch (e) {
      console.error('AuditLog (reissue password) failed:', e.message);
    }

    // Return plaintext password ONCE (do not store plaintext)
    res.json({
      success: true,
      message: '仮パスワードを再発行しました（この画面でのみ表示されます）。',
      loginId: user.loginId,
      internalId: user.internalId,
      tempPassword,
    });
  } catch (error) {
    console.error('Reissue password error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。',
    });
  }
});

module.exports = router;

