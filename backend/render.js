// This is a simple entry point specifically for Render.com
// It forces production mode and binds to 0.0.0.0 explicitly

// Set production mode
process.env.NODE_ENV = 'production';
console.log('Starting server in PRODUCTION mode');

// Import the Express app
const express = require('express');
const app = require('./app');

// Get port from environment
const PORT = process.env.PORT || 3000;

// Listen on all interfaces for Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} and bound to 0.0.0.0`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
}); 