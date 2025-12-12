const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const testConnection = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nigrek-dental';
  
  console.log('🔍 Testing MongoDB connection...');
  console.log(`📍 Connection URI: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials
  
  try {
    await mongoose.connect(mongoUri);
    
    console.log('✅ MongoDB connected successfully!');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    
    // Test a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📁 Collections: ${collections.length}`);
    
    // Close connection
    await mongoose.connection.close();
    console.log('✅ Connection test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB connection failed!');
    console.error('Error details:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.error('\n💡 Tip: Check your username and password in the connection string');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n💡 Tip: Check your cluster hostname in the connection string');
    } else if (error.message.includes('IP')) {
      console.error('\n💡 Tip: Add your IP address to MongoDB Atlas Network Access whitelist');
    } else if (error.message.includes('timeout')) {
      console.error('\n💡 Tip: Check your internet connection and firewall settings');
    }
    
    process.exit(1);
  }
};

testConnection();

