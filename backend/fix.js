// Quick fix script for testing database connection on Render.com
const dotenv = require('dotenv');
const pgp = require('pg-promise')();
const express = require('express');

dotenv.config();

console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`DATABASE_URL present: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);

// Force NODE_ENV
process.env.NODE_ENV = 'production';

const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
};

// Connect to PostgreSQL
const db = pgp(dbConfig);

async function testConnection() {
  try {
    // Test connection
    const result = await db.one('SELECT NOW() as time');
    console.log('Database connection successful:', result.time);
    
    // Test user table
    const users = await db.any('SELECT COUNT(*) as count FROM "User"');
    console.log('User table accessible, count:', users[0].count);
    
    // Test a sample select
    const sample = await db.oneOrNone('SELECT * FROM "User" LIMIT 1');
    console.log('Sample user (if any):', sample ? sample.username : 'No users found');
    
    console.log('Database tests PASSED');
    
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

async function startTestServer() {
  try {
    const success = await testConnection();
    
    if (!success) {
      console.error('Database checks failed');
      process.exit(1); // Exit with error
    }
    
    // Create minimal Express server for Render to detect
    const app = express();
    
    app.get('/', (req, res) => {
      res.send('Database connection successful! Ready to deploy main app.');
    });
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Test server running on port ${PORT}`);
      console.log('Ready to start the main server');
    });
    
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

startTestServer(); 