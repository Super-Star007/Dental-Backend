const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Trust reverse proxy (for correct client IP via X-Forwarded-For)
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
const path = require('path');
const uploadsPath = path.join(__dirname, 'uploads');
console.log('📁 Serving static files from:', uploadsPath);

// Serve static files with proper MIME types
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath, stat) => {
    // Set proper Content-Type headers for images
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/facilities', require('./routes/facilities'));
app.use('/api/masters', require('./routes/masters'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Nigrek Dental Visit System API' });
});

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nigrek-dental';

// Log connection attempt (hide credentials)
const safeUri = mongoUri.replace(/\/\/.*@/, '//***:***@');
console.log(`🔗 Connecting to MongoDB: ${safeUri}`);

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    if (err.message.includes('authentication failed')) {
      console.error('💡 Tip: Check your username and password in MONGODB_URI');
    } else if (err.message.includes('IP')) {
      console.error('💡 Tip: Add your IP address to MongoDB Atlas Network Access whitelist');
    } else if (err.message.includes('ENOTFOUND')) {
      console.error('💡 Tip: Check your cluster hostname in MONGODB_URI');
    }
    console.error('📖 See backend/MONGODB_SETUP.md for setup instructions');
  });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

