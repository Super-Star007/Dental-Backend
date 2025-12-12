const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (Admin only) or filter by role
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { role } = req.query;
    const query = {};

    // If role filter is provided, allow all authenticated users to see filtered results
    // Otherwise, only admin can see all users
    if (role) {
      const roles = role.split(',');
      query.role = { $in: roles };
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'この操作を実行する権限がありません。',
      });
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
    user.avatar = `/uploads/avatars/${req.file.filename}`;
    await user.save();

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
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('有効なメールアドレスを入力してください'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('role')
      .optional()
      .isIn(['admin', 'dentist', 'hygienist', 'staff', 'billing'])
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

      const { name, email, phone, address, role, oldPassword, newPassword, confirmPassword } =
        req.body;
      const user = await User.findById(req.user.id).select('+password');

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
      if (role && req.user.role === 'admin') {
        // Only admin can change roles
        user.role = role;
      } else if (role && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '役割の変更は管理者のみ可能です。',
        });
      }

      // Save user
      await user.save();

      res.json({
        success: true,
        message: 'プロフィールが更新されました。',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
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

module.exports = router;

