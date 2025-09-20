console.error("API Gateway starting...");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
require("dotenv").config();

// Import middleware and routes
const authMiddleware = require("./middleware/auth");
const rateLimiterMiddleware = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");

// Import route handlers
const authRoutes = require("./routes/auth");
const clientRoutes = require("./routes/clients");
const orderRoutes = require("./routes/orders");
const routeRoutes = require("./routes/routes");
const warehouseRoutes = require("./routes/warehouse");
const notificationRoutes = require("./routes/notifications");
const healthRoutes = require("./routes/health");

// Import services
const databaseService = require("./shared/database/connection");
const rabbitMQService = require("./shared/messaging/rabbitmq");

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:8080",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:8080",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
app.use(morgan("combined"));
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Health check endpoint (no rate limiting)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "API Gateway",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Diagnostic logging for route handlers and middleware
console.log(
  "authRoutes:",
  typeof authRoutes,
  authRoutes.constructor && authRoutes.constructor.name
);
console.log(
  "clientRoutes:",
  typeof clientRoutes,
  clientRoutes.constructor && clientRoutes.constructor.name
);
console.log(
  "orderRoutes:",
  typeof orderRoutes,
  orderRoutes.constructor && orderRoutes.constructor.name
);
console.log(
  "routeRoutes:",
  typeof routeRoutes,
  routeRoutes.constructor && routeRoutes.constructor.name
);
console.log(
  "warehouseRoutes:",
  typeof warehouseRoutes,
  warehouseRoutes.constructor && warehouseRoutes.constructor.name
);
console.log(
  "notificationRoutes:",
  typeof notificationRoutes,
  notificationRoutes.constructor && notificationRoutes.constructor.name
);
console.log(
  "healthRoutes:",
  typeof healthRoutes,
  healthRoutes.constructor && healthRoutes.constructor.name
);
console.log(
  "authMiddleware.verifyToken:",
  typeof authMiddleware.verifyToken,
  authMiddleware.verifyToken.constructor &&
    authMiddleware.verifyToken.constructor.name
);


// Public health endpoints for all services (before auth middleware)
app.use("/api/clients/health", (req, res) => res.json({ status: "OK", service: "Client Service", timestamp: new Date().toISOString(), uptime: process.uptime() }));
app.use("/api/orders/health", (req, res) => res.json({ status: "OK", service: "Order Service", timestamp: new Date().toISOString(), uptime: process.uptime() }));
app.use("/api/routes/health", (req, res) => res.json({ status: "OK", service: "Route Service", timestamp: new Date().toISOString(), uptime: process.uptime() }));
app.use("/api/warehouse/health", (req, res) => res.json({ status: "OK", service: "Warehouse Service", timestamp: new Date().toISOString(), uptime: process.uptime() }));
app.use("/api/notifications/health", (req, res) => res.json({ status: "OK", service: "Notification Service", timestamp: new Date().toISOString(), uptime: process.uptime() }));

// Public proxy for client registration and login (before auth middleware)
const { createProxyMiddleware } = require('http-proxy-middleware');
const CLIENT_SERVICE_URL = process.env.CLIENT_SERVICE_URL || 'http://client-service:3001';
app.use('/api/clients/register', createProxyMiddleware({
  target: CLIENT_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/clients': '/api/clients' },
}));
app.use('/api/clients/login', createProxyMiddleware({
  target: CLIENT_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/clients': '/api/clients' },
}));

// API routes (protected)
console.error("DEBUG: Mounting /api/auth route");
app.use("/api/auth", authRoutes);
app.use(
  "/api/clients",
  authMiddleware.verifyToken.bind(authMiddleware),
  clientRoutes
);
app.use(
  "/api/orders",
  authMiddleware.verifyToken.bind(authMiddleware),
  orderRoutes
);
app.use(
  "/api/routes",
  authMiddleware.verifyToken.bind(authMiddleware),
  routeRoutes
);
app.use(
  "/api/warehouse",
  authMiddleware.verifyToken.bind(authMiddleware),
  warehouseRoutes
);
app.use(
  "/api/notifications",
  authMiddleware.verifyToken.bind(authMiddleware),
  notificationRoutes
);
app.use("/api/health", healthRoutes);

// WebSocket connection handling
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Join client to their specific room
  socket.on("join-client", (clientId) => {
    socket.join(`client-${clientId}`);
    console.log(`👤 Client ${clientId} joined room`);
  });

  // Join driver to their specific room
  socket.on("join-driver", (driverId) => {
    socket.join(`driver-${driverId}`);
    console.log(`🚗 Driver ${driverId} joined room`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Make io available to routes
app.set("io", io);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🔄 SIGTERM received, shutting down gracefully...");
  await gracefulShutdown();
});

process.on("SIGINT", async () => {
  console.log("🔄 SIGINT received, shutting down gracefully...");
  await gracefulShutdown();
});

async function gracefulShutdown() {
  try {
    // Close database connections
    await databaseService.closeMongoDB();
    await databaseService.closeRedis();

    // Close RabbitMQ connection
    await rabbitMQService.close();

    // Close HTTP server
    server.close(() => {
      console.log("✅ HTTP server closed");
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error(
        "❌ Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error("❌ Error during graceful shutdown:", error);
    process.exit(1);
  }
}

// Initialize services and start server
async function startServer() {
  try {
    console.log("🚀 Starting SwiftLogistics API Gateway...");

    // Connect to databases
    if (process.env.MONGODB_URI) {
      await databaseService.connectMongoDB(process.env.MONGODB_URI);
    }

    if (process.env.REDIS_URL) {
      await databaseService.connectRedis(process.env.REDIS_URL);
    }

    // Connect to RabbitMQ
    if (process.env.RABBITMQ_URL) {
      await rabbitMQService.connect(process.env.RABBITMQ_URL);

      // Create exchanges and queues for the API Gateway
      await rabbitMQService.createExchange("swiftlogistics.events", "topic");
      await rabbitMQService.createExchange("swiftlogistics.commands", "topic");

      // Create queues for different event types
      await rabbitMQService.createQueue("api-gateway.notifications");
      await rabbitMQService.createQueue("api-gateway.audit");

      // Bind queues to exchanges
      await rabbitMQService.bindQueue(
        "api-gateway.notifications",
        "swiftlogistics.events",
        "notification.*"
      );
      await rabbitMQService.bindQueue(
        "api-gateway.audit",
        "swiftlogistics.events",
        "audit.*"
      );
    }

    // Start server
    server.listen(PORT, () => {
      console.log(`✅ API Gateway server running on port ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`📡 WebSocket server ready`);
    });
  } catch (error) {
    console.error("❌ Failed to start API Gateway:", error);
    process.exit(1);
  }
}

// Start the server
// Global error handlers for uncaught exceptions and unhandled promise rejections
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  if (err && err.stack) {
    console.error("Stack trace:", err.stack);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
  if (reason && reason.stack) {
    console.error("Stack trace:", reason.stack);
  }
});

startServer();

module.exports = { app, server, io };
