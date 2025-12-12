const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy (only initialize if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && 
    process.env.GOOGLE_CLIENT_SECRET && 
    process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id' &&
    process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret') {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists with this Google ID
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            return done(null, user);
          }

          // Check if user exists with this email
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // Link Google account to existing user
            user.googleId = profile.id;
            if (!user.avatar && profile.photos && profile.photos[0]) {
              user.avatar = profile.photos[0].value;
            }
            await user.save();
            return done(null, user);
          }

          // Create new user
          user = await User.create({
            name: profile.displayName || profile.name.givenName + ' ' + profile.name.familyName,
            email: profile.emails[0].value,
            googleId: profile.id,
            avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            role: 'staff', // Default role
          });

          return done(null, user);
        } catch (error) {
          console.error('Google OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );
  console.log('✅ Google OAuth strategy initialized');
} else {
  console.log('⚠️  Google OAuth not configured (missing credentials)');
}

// Facebook OAuth Strategy (only initialize if credentials are provided)
if (process.env.FACEBOOK_APP_ID && 
    process.env.FACEBOOK_APP_SECRET && 
    process.env.FACEBOOK_APP_ID !== 'your_facebook_app_id' &&
    process.env.FACEBOOK_APP_SECRET !== 'your_facebook_app_secret') {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'email', 'picture.type(large)'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists with this Facebook ID
          let user = await User.findOne({ facebookId: profile.id });

          if (user) {
            return done(null, user);
          }

          // Check if user exists with this email
          if (profile.emails && profile.emails[0]) {
            user = await User.findOne({ email: profile.emails[0].value });

            if (user) {
              // Link Facebook account to existing user
              user.facebookId = profile.id;
              if (!user.avatar && profile.photos && profile.photos[0]) {
                user.avatar = profile.photos[0].value;
              }
              await user.save();
              return done(null, user);
            }
          }

          // Create new user
          user = await User.create({
            name: profile.displayName || profile.name.givenName + ' ' + profile.name.familyName,
            email: profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@facebook.com`,
            facebookId: profile.id,
            avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            role: 'staff', // Default role
          });

          return done(null, user);
        } catch (error) {
          console.error('Facebook OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );
  console.log('✅ Facebook OAuth strategy initialized');
} else {
  console.log('⚠️  Facebook OAuth not configured (missing credentials)');
}

module.exports = passport;

