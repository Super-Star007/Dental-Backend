const express = require('express');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');

// Initialize passport
require('../config/passport');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('名前を入力してください'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('有効なメールアドレスを入力してください'),
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

      const { name, email, password, role } = req.body;

      // Check if user already exists
      const userExists = await User.findOne({ email });

      if (userExists) {
        return res.status(400).json({
          success: false,
          message: 'このメールアドレスは既に登録されています。',
        });
      }

      // Create user
      const user = await User.create({
        name,
        email,
        password,
        role: role || 'staff',
      });

      // Generate token
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        message: 'ユーザー登録が完了しました。',
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
      .isEmail()
      .normalizeEmail()
      .withMessage('有効なメールアドレスを入力してください'),
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

      const { email, password } = req.body;

      // Check if user exists and get password
      const user = await User.findOne({ email }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'メールアドレスまたはパスワードが正しくありません。',
          errorType: 'INVALID_CREDENTIALS',
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'このアカウントは無効です。管理者にお問い合わせください。',
          errorType: 'ACCOUNT_INACTIVE',
        });
      }

      // Check if user is OAuth-only (no password set)
      if ((user.googleId || user.facebookId) && !user.password) {
        return res.status(401).json({
          success: false,
          message: 'このアカウントはGoogleまたはFacebookで登録されています。OAuthログインを使用してください。',
          errorType: 'OAUTH_ONLY_ACCOUNT',
        });
      }

      // Check if user has password
      if (!user.password) {
        return res.status(401).json({
          success: false,
          message: 'パスワードが設定されていません。パスワードリセット機能を使用してください。',
          errorType: 'NO_PASSWORD',
        });
      }

      // Check password
      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'メールアドレスまたはパスワードが正しくありません。',
          errorType: 'INVALID_PASSWORD',
        });
      }

      // Generate token
      const token = generateToken(user._id);

      res.json({
        success: true,
        message: 'ログインに成功しました。',
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

      // Create reset url
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

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
        await sendEmail({
          email: user.email,
          subject: 'パスワードリセット - 株式会社 Nigrek',
          message,
        });

        res.json({
          success: true,
          message: 'パスワードリセット用のメールを送信しました。',
        });
      } catch (error) {
        console.error('Email send error:', error);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });

        return res.status(500).json({
          success: false,
          message: 'メール送信に失敗しました。後でもう一度お試しください。',
        });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'サーバーエラーが発生しました。',
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

      // Get hashed token
      const resetPasswordToken = crypto
        .createHash('sha256')
        .update(req.params.resettoken)
        .digest('hex');

      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
      });

      if (!user) {
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

