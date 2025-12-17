const express = require('express');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const { protect, authorize } = require('../middleware/auth');

// Initialize passport
require('../config/passport');

const router = express.Router();

// Self-registration is not allowed (policy)
// Keeping endpoint path for compatibility, but it now requires system_admin/admin (see above).

// @route   POST /api/auth/register
// @desc    Provision a clinic account (no self-registration)
// @access  Private (system_admin/admin only)
router.post(
  '/register',
  protect,
  authorize('system_admin', 'admin'),
  [
    body('name').trim().notEmpty().withMessage('名前を入力してください'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('有効なメールアドレスを入力してください'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('パスワードは6文字以上で入力してください'),
    body('loginId')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 3 })
      .withMessage('ログインIDは3文字以上で入力してください'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '入力内容を確認してください。',
          errors: errors.array(),
        });
      }

      const { name, email, password, loginId } = req.body;

      // Check if user already exists
      const userExists = await User.findOne({ email });

      if (userExists) {
        return res.status(400).json({
          success: false,
          message: 'このメールアドレスは既に登録されています。',
        });
      }

      // Prevent loginId collision
      if (loginId) {
        const loginIdExists = await User.findOne({ loginId });
        if (loginIdExists) {
          return res.status(400).json({
            success: false,
            message: 'このログインIDは既に使用されています。',
          });
        }
      }

      // Create clinic admin account (role fixed by policy)
      const user = await User.create({
        name,
        email,
        password,
        loginId: loginId || email,
        role: 'clinic_admin',
        mustChangePassword: true,
      });

      // Audit
      try {
        await AuditLog.create({
          actorRole: req.user.role,
          actorId: req.user._id,
          action: 'clinic_account_created',
          targetUserId: user._id,
          targetInternalId: user.internalId,
          meta: {
            email: user.email,
            loginId: user.loginId,
            role: user.role,
          },
        });
      } catch (e) {
        // Do not fail provisioning on audit failure
        console.error('AuditLog create failed:', e.message);
      }

      res.status(201).json({
        success: true,
        message: '医院アカウントを発行しました。',
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
          isActive: user.isActive,
          deletedAt: user.deletedAt,
          mustChangePassword: user.mustChangePassword,
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      
      // Return more detailed error in development
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'サーバーエラーが発生しました。'
        : error.message || 'サーバーエラーが発生しました。';
      
      res.status(500).json({
        success: false,
        message: errorMessage,
        ...(process.env.NODE_ENV !== 'production' && { error: error.stack }),
      });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  [
    body('email')
      .optional({ checkFalsy: true })
      .isEmail()
      .normalizeEmail()
      .withMessage('有効なメールアドレスを入力してください'),
    body('loginId')
      .optional({ checkFalsy: true })
      .trim()
      .notEmpty()
      .withMessage('ログインIDを入力してください'),
    body().custom((_, { req }) => {
      if (!req.body.email && !req.body.loginId) {
        throw new Error('ログインIDまたはメールアドレスを入力してください');
      }
      return true;
    }),
    body('password').notEmpty().withMessage('パスワードを入力してください'),
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

      const { email, loginId, password } = req.body;

      // Check if user exists and get password
      const user = await User.findOne({
        $or: [
          ...(email ? [{ email }] : []),
          ...(loginId ? [{ loginId }] : []),
        ],
      }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'メールアドレスまたはパスワードが正しくありません。',
        });
      }

      // Check if user is active
      if (!user.isActive || user.deletedAt) {
        return res.status(401).json({
          success: false,
          message: 'このアカウントは無効です。管理者にお問い合わせください。',
        });
      }

      // Check password
      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'メールアドレスまたはパスワードが正しくありません。',
        });
      }

      // Generate token
      const token = generateToken(user._id);

      // Update last login timestamp (best-effort) + audit
      try {
        const ip =
          (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
          req.ip ||
          req.socket?.remoteAddress ||
          null;
        const userAgent = req.headers['user-agent'] || null;

        user.lastLoginAt = new Date();
        user.lastLoginIp = ip;
        await user.save({ validateBeforeSave: false });
      } catch (e) {
        // ignore
      }
      try {
        const ip =
          (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
          req.ip ||
          req.socket?.remoteAddress ||
          null;
        const userAgent = req.headers['user-agent'] || null;

        await AuditLog.create({
          actorRole: user.role,
          actorId: user._id,
          action: 'login_success',
          targetUserId: user._id,
          targetInternalId: user.internalId,
          meta: { loginId: user.loginId, email: user.email, ip, userAgent },
        });
      } catch (e) {
        // ignore
      }

      res.json({
        success: true,
        message: 'ログインに成功しました。',
        token,
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
          mustChangePassword: user.mustChangePassword,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'サーバーエラーが発生しました。',
      });
    }
  }
);

// @route   POST /api/auth/forgotpassword
// @desc    Send password reset email
// @access  Public
router.post(
  '/forgotpassword',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('有効なメールアドレスを入力してください'),
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

      const { email } = req.body;

      const user = await User.findOne({ email });

      if (!user) {
        // Don't reveal if user exists for security
        return res.json({
          success: true,
          message: 'パスワードリセット用のメールを送信しました。',
        });
      }

      // Get reset token
      const resetToken = user.getResetPasswordToken();
      await user.save({ validateBeforeSave: false });

      // Create reset url with fallback
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      const message = `
        <h2>パスワードリセットのご案内</h2>
        <p>パスワードリセットのリクエストを受け付けました。</p>
        <p>以下のリンクをクリックして、新しいパスワードを設定してください。</p>
        <p>このリンクは10分間有効です。</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #e91e63; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">パスワードをリセット</a>
        <p>もしこのリクエストをしていない場合は、このメールを無視してください。</p>
        <hr>
        <p style="color: #666; font-size: 12px;">株式会社 Nigrek</p>
      `;

      try {
        // Check if email configuration is available
        if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
          console.error('Email configuration missing. Please set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env file.');
          // Still return success to user for security, but log the error
          console.log('Password reset token generated (email not sent):', resetToken);
          return res.json({
            success: true,
            message: 'パスワードリセット用のメールを送信しました。',
            // In development, include the reset token for testing
            ...(process.env.NODE_ENV !== 'production' && { 
              resetToken: resetToken,
              resetUrl: resetUrl 
            }),
          });
        }

        try {
          await sendEmail({
            email: user.email,
            subject: 'パスワードリセット - 株式会社 Nigrek',
            message,
          });

          res.json({
            success: true,
            message: 'パスワードリセット用のメールを送信しました。',
          });
        } catch (emailError) {
          console.error('Email send error:', emailError);
          
          // In development, don't delete the token - return it for testing
          if (process.env.NODE_ENV !== 'production') {
            console.log('Development mode: Returning reset token despite email failure');
            return res.json({
              success: true,
              message: 'パスワードリセット用のメールを送信しました。',
              resetToken: resetToken,
              resetUrl: resetUrl,
              error: 'メール送信に失敗しましたが、開発環境のためトークンを返します。',
            });
          }

          // In production, delete the token only if email fails
          // This prevents token reuse if email service is down
          user.resetPasswordToken = undefined;
          user.resetPasswordExpire = undefined;
          await user.save({ validateBeforeSave: false });

          return res.status(500).json({
            success: false,
            message: 'メール送信に失敗しました。後でもう一度お試しください。',
          });
        }
      } catch (error) {
        console.error('Unexpected error in forgot password:', error);
        
        // In development, still return the token if we have it
        if (process.env.NODE_ENV !== 'production' && resetToken) {
          return res.json({
            success: true,
            message: 'パスワードリセット用のメールを送信しました。',
            resetToken: resetToken,
            resetUrl: resetUrl,
            error: '予期しないエラーが発生しましたが、開発環境のためトークンを返します。',
          });
        }

        return res.status(500).json({
          success: false,
          message: 'サーバーエラーが発生しました。後でもう一度お試しください。',
        });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      console.error('Error stack:', error.stack);
      
      // Return detailed error in development
      const errorMessage = process.env.NODE_ENV !== 'production'
        ? error.message || 'サーバーエラーが発生しました。'
        : 'サーバーエラーが発生しました。';
      
      res.status(500).json({
        success: false,
        message: errorMessage,
        ...(process.env.NODE_ENV !== 'production' && { 
          error: error.message,
          stack: error.stack 
        }),
      });
    }
  }
);

// @route   PUT /api/auth/resetpassword/:resettoken
// @desc    Reset password
// @access  Public
router.put(
  '/resetpassword/:resettoken',
  [
    body('password')
      .isLength({ min: 6 })
      .withMessage('パスワードは6文字以上で入力してください'),
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

      // Check if token parameter exists
      if (!req.params.resettoken) {
        return res.status(400).json({
          success: false,
          message: 'リセットトークンが提供されていません。',
        });
      }

      // Get hashed token - decode URL encoding if present
      let rawToken;
      try {
        rawToken = decodeURIComponent(req.params.resettoken);
      } catch (e) {
        // If decoding fails, use the token as-is
        rawToken = req.params.resettoken;
      }
      const resetPasswordToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      // Debug logging in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('Reset password attempt:');
        console.log('Raw token:', rawToken);
        console.log('Hashed token:', resetPasswordToken);
      }

      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
      });

      if (!user) {
        // Additional check: see if token exists but expired
        const expiredUser = await User.findOne({ resetPasswordToken });
        if (expiredUser) {
          console.log('Token found but expired. Expire time:', expiredUser.resetPasswordExpire, 'Current time:', Date.now());
        } else {
          console.log('Token not found in database');
        }

        return res.status(400).json({
          success: false,
          message: '無効または期限切れのトークンです。',
        });
      }

      // Set new password
      user.password = req.body.password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      // Generate token
      const token = generateToken(user._id);

      res.json({
        success: true,
        message: 'パスワードが正常にリセットされました。',
        token,
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
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'サーバーエラーが発生しました。',
      });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。',
    });
  }
});

// Check if Google OAuth is configured
const isGoogleOAuthConfigured = process.env.GOOGLE_CLIENT_ID && 
  process.env.GOOGLE_CLIENT_SECRET && 
  process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id' &&
  process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret';

// Check if Facebook OAuth is configured
const isFacebookOAuthConfigured = process.env.FACEBOOK_APP_ID && 
  process.env.FACEBOOK_APP_SECRET && 
  process.env.FACEBOOK_APP_ID !== 'your_facebook_app_id' &&
  process.env.FACEBOOK_APP_SECRET !== 'your_facebook_app_secret';

// @route   GET /api/auth/google
// @desc    Initiate Google OAuth login
// @access  Public
router.get(
  '/google',
  (req, res, next) => {
    if (!isGoogleOAuthConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.',
      });
    }
    next();
  },
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// @route   GET /api/auth/google/callback
// @desc    Google OAuth callback
// @access  Public
router.get(
  '/google/callback',
  (req, res, next) => {
    if (!isGoogleOAuthConfigured) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_not_configured`);
    }
    next();
  },
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed` }),
  async (req, res) => {
    try {
      const user = req.user;
      
      // Generate token
      const token = generateToken(user._id);

      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
      }))}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
    }
  }
);

// @route   GET /api/auth/facebook
// @desc    Initiate Facebook OAuth login
// @access  Public
router.get(
  '/facebook',
  (req, res, next) => {
    if (!isFacebookOAuthConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Facebook OAuth is not configured. Please set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in your .env file.',
      });
    }
    next();
  },
  passport.authenticate('facebook', {
    scope: ['email'],
  })
);

// @route   GET /api/auth/facebook/callback
// @desc    Facebook OAuth callback
// @access  Public
router.get(
  '/facebook/callback',
  (req, res, next) => {
    if (!isFacebookOAuthConfigured) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_not_configured`);
    }
    next();
  },
  passport.authenticate('facebook', { session: false, failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed` }),
  async (req, res) => {
    try {
      const user = req.user;
      
      // Generate token
      const token = generateToken(user._id);

      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
      }))}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Facebook OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
    }
  }
);

module.exports = router;

