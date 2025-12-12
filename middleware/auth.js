const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '認証が必要です。ログインしてください。',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'ユーザーが見つかりません。',
      });
    }

    if (!req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'このアカウントは無効です。',
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '認証に失敗しました。',
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `この操作を実行する権限がありません。`,
      });
    }
    next();
  };
};

