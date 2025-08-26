// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const http = require("http");
const socketIo = require("socket.io");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

// Load environment variables first
dotenv.config();

// Import configurations and middleware
const database = require("./config/database");
const redisConnection = require("./config/redis");
const logger = require("./config/logger");
const { securityHeaders, generalRateLimit, speedLimiter, sanitizeInput } = require("./middleware/security");
const { globalErrorHandler, notFound } = require("./middleware/errorHandler");

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Socket.IO configuration
const allowedOrigins = process.env.SOCKET_CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Make io accessible from routes
app.set("io", io);

// Socket.IO connection handling
io.on("connection", (socket) => {
  logger.info("🔌 New client connected", {
    socketId: socket.id,
    userAgent: socket.handshake.headers['user-agent'],
    ip: socket.handshake.address
  });

  socket.on("disconnect", (reason) => {
    logger.info("🔌 Client disconnected", {
      socketId: socket.id,
      reason
    });
  });

  socket.on("error", (error) => {
    logger.error("Socket error:", {
      socketId: socket.id,
      error: error.message
    });
  });
});

// Security middleware (must be early in the stack)
app.use(securityHeaders);

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// Compression middleware
app.use(compression());

// Rate limiting and speed limiting
app.use(generalRateLimit);
app.use(speedLimiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Health check endpoint (before other routes)
app.get('/health', (req, res) => {
  const dbStatus = database.getConnectionStatus();
  const redisStatus = redisConnection.isReady();

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: {
        status: dbStatus.isConnected ? 'connected' : 'disconnected',
        host: dbStatus.host,
        database: dbStatus.database
      },
      redis: {
        status: redisStatus ? 'connected' : 'disconnected'
      }
    },
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };

  const statusCode = dbStatus.isConnected ? 200 : 503;
  res.status(statusCode).json(health);
});

// API documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "AmarBin API Documentation"
}));

// API routes
const apiPrefix = process.env.API_PREFIX || '/api';
app.use(`${apiPrefix}/auth`, require("./routes/auth"));
app.use(`${apiPrefix}/admin`, require("./routes/admin"));
app.use(`${apiPrefix}/pickups`, require("./routes/pickups"));

// 404 handler for undefined routes
app.use(notFound);

// Global error handling middleware (must be last)
app.use(globalErrorHandler);

// Server startup function
async function startServer() {
  try {
    // Connect to databases
    logger.info('🚀 Starting AmarBin Backend Server...');

    // Connect to MongoDB
    await database.connect();

    // Connect to Redis (optional)
    await redisConnection.connect();

    // Start HTTP server
    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || '0.0.0.0';

    server.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on ${HOST}:${PORT}`, {
        environment: process.env.NODE_ENV,
        port: PORT,
        host: HOST,
        apiDocs: `http://${HOST}:${PORT}/api-docs`,
        healthCheck: `http://${HOST}:${PORT}/health`
      });
    });

    // Cleanup expired tokens periodically (every hour)
    setInterval(async () => {
      try {
        const User = require('./models/User');
        await User.cleanupExpiredTokens();
      } catch (error) {
        logger.error('Error cleaning up expired tokens:', error);
      }
    }, 60 * 60 * 1000);

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown function
async function gracefulShutdown(signal) {
  logger.info(`📴 Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('🔌 HTTP server closed');

    try {
      // Close database connections
      await database.disconnect();
      await redisConnection.disconnect();

      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('💀 Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
startServer();

module.exports = { app, server, io };
