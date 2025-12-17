const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // Validate email configuration
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email configuration is missing. Please set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env file.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Add timeout and connection options (increased for better reliability)
    connectionTimeout: 30000, // 30 seconds
    greetingTimeout: 30000, // 30 seconds
    socketTimeout: 30000, // 30 seconds
    // Add TLS options for better compatibility
    tls: {
      rejectUnauthorized: false, // Only for development, should be true in production
    },
  });

  // Verify transporter configuration (skip in development if it fails)
  // This is optional and can be skipped if network issues occur
  try {
    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Verification timeout')), 5000)
      )
    ]);
    console.log('Email server is ready to send messages');
  } catch (error) {
    // In development, log warning but don't fail
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Email server verification failed or timed out:', error.message);
      console.warn('Continuing anyway - email will be sent without verification');
    } else {
      console.error('Email server verification failed:', error);
      throw new Error('Email server configuration is invalid. Please check your email settings.');
    }
  }

  const message = {
    from: process.env.EMAIL_FROM 
      ? `${process.env.EMAIL_FROM} <${process.env.EMAIL_USER}>`
      : process.env.EMAIL_USER,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  try {
    const info = await transporter.sendMail(message);
    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = sendEmail;

