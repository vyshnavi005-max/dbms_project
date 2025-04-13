const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

// Database configuration
const config = {
    development: {
        client: 'sqlite3',
        connection: {
            filename: path.join(__dirname, 'twitterClone.db')
        },
        useNullAsDefault: true
    },
    production: {
        client: 'pg',
        connection: process.env.DATABASE_URL || {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'your_password',
            database: process.env.DB_NAME || 'twitter_clone'
        }
    }
};

// Get current environment
const environment = process.env.NODE_ENV || 'development';
const currentConfig = config[environment];

// Initialize database connection
let db;

if (environment === 'production') {
    // PostgreSQL connection
    db = new Pool(currentConfig.connection);
} else {
    // SQLite connection
    (async () => {
        db = await open({
            filename: currentConfig.connection.filename,
            driver: sqlite3.Database
        });
    })();
}

module.exports = db; 