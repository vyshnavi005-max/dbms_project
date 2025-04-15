// Quick fix script for testing database connection on Render.com
const dotenv = require('dotenv');
const pgp = require('pg-promise')();

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
  } finally {
    // Close db connection
    pgp.end();
  }
}

testConnection().then(success => {
  if (success) {
    console.log('Ready to start the server');
    process.exit(0); // Exit with success
  } else {
    console.error('Database checks failed');
    process.exit(1); // Exit with error
  }
}); 