require('dotenv').config();

const fs = require('fs');
const path = require('path');
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;
const BACKEND_ROOT = __dirname;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[server] Created directory: ${dirPath}`);
  }
}

const startServer = async () => {
  try {
    ensureDir(path.join(BACKEND_ROOT, 'uploads'));
    ensureDir(path.join(BACKEND_ROOT, 'outputs'));

    // Connect to MongoDB
    await connectDB();

    // Start HTTP server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('🚀 ================================');
      console.log(`🚀  Server running on port ${PORT}`);
      console.log(`🚀  Environment: ${process.env.NODE_ENV}`);
      console.log(`🚀  Health: http://localhost:${PORT}/health`);
      console.log(`🚀  API Base: http://localhost:${PORT}/api`);
      console.log(`🚀  Audio:  POST ${PORT}/api/audio/opus-to-wav`);
      console.log(`🚀  Downloads: http://localhost:${PORT}/downloads/`);
      console.log('🚀 ================================');
      console.log('');
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      server.close(() => process.exit(1));
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
