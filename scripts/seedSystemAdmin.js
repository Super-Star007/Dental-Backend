/**
 * Seed / upsert initial system_admin user.
 *
 * Usage:
 *   node scripts/seedSystemAdmin.js --loginId xxx --email xxx --password xxx --name "Your Name"
 *
 * If omitted, falls back to env vars:
 *   SYSTEM_ADMIN_LOGIN_ID, SYSTEM_ADMIN_EMAIL, SYSTEM_ADMIN_PASSWORD, SYSTEM_ADMIN_NAME
 */
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('../models/User');

dotenv.config();

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

async function main() {
  const loginId =
    getArg('--loginId') ||
    process.env.SYSTEM_ADMIN_LOGIN_ID ||
    getArg('--email') ||
    process.env.SYSTEM_ADMIN_EMAIL;
  const email = getArg('--email') || process.env.SYSTEM_ADMIN_EMAIL || loginId;
  const password = getArg('--password') || process.env.SYSTEM_ADMIN_PASSWORD;
  const name = getArg('--name') || process.env.SYSTEM_ADMIN_NAME || 'System Admin';

  if (!loginId) throw new Error('loginId is required (--loginId)');
  if (!email) throw new Error('email is required (--email)');
  if (!password) throw new Error('password is required (--password)');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nigrek-dental';

  await mongoose.connect(mongoUri);

  // Upsert by loginId first (since login uses loginId), fallback to email.
  let user = await User.findOne({ loginId }).select('+password');
  if (!user) {
    user = await User.findOne({ email }).select('+password');
  }

  if (!user) {
    user = new User({
      name,
      email,
      loginId,
      password,
      role: 'system_admin',
      isActive: true,
      deletedAt: null,
    });
    await user.save();
    console.log('[seedSystemAdmin] Created system_admin:', {
      id: user._id.toString(),
      internalId: user.internalId,
      loginId: user.loginId,
      email: user.email,
      role: user.role,
    });
  } else {
    user.name = name;
    user.email = email;
    user.loginId = loginId;
    user.role = 'system_admin';
    user.isActive = true;
    user.deletedAt = null;
    user.password = password;
    user.markModified('password'); // ensure hashing runs
    await user.save();
    console.log('[seedSystemAdmin] Updated system_admin:', {
      id: user._id.toString(),
      internalId: user.internalId,
      loginId: user.loginId,
      email: user.email,
      role: user.role,
    });
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[seedSystemAdmin] Error:', err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});


