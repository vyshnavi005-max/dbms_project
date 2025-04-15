const http = require('http');

// Force NODE_ENV to production if running on Render
if (process.env.RENDER || process.env.DATABASE_URL) {
    process.env.NODE_ENV = 'production';
}

// Log environment information before loading app.js
console.log(`Starting server with NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`Database URL present: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);
console.log(`Running on Render: ${process.env.RENDER ? 'Yes' : 'No'}`);

const app = require('./app');

// Get the port from environment variables or default to 3000
const PORT = process.env.PORT || 3000;

// Start the server on 0.0.0.0 for Render to detect it
const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Current NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});