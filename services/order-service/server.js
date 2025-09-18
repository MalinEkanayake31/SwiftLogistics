const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
require('dotenv').config();

// Import services
const databaseService = require('./shared/database/connection');
const rabbitMQService = require('./shared/messaging/rabbitmq');

// Import models
const Order = require('./models/Order');
const Package = require('./models/Package');

// Import services
const orderProcessor = require('./services/orderProcessor');
const workflowEngine = require('./services/workflowEngine');
const integrationService = require('./services/integrationService');

// Import routes
const orderRoutes = require('./routes/orders');
const packageRoutes = require('./routes/packages');
const workflowRoutes = require('./routes/workflow');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:8080",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:8080",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Order Management Service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/orders', orderRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/workflow', workflowRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Order Service client connected: ${socket.id}`);
  
  // Join client to their specific room
  socket.on('join-client', (clientId) => {
    socket.join(`client-${clientId}`);
    console.log(`👤 Client ${clientId} joined order service room`);
  });
  
  // Join driver to their specific room
  socket.on('join-driver', (driverId) => {
    socket.join(`driver-${driverId}`);
    console.log(`🚗 Driver ${driverId} joined order service room`);
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 Order Service client disconnected: ${socket.id}`);
  });
});

// Make io available to routes and services
app.set('io', io);

// Initialize RabbitMQ consumers
async function initializeConsumers() {
  try {
    // Create exchanges
    await rabbitMQService.createExchange('swiftlogistics.orders', 'topic');
    await rabbitMQService.createExchange('swiftlogistics.workflow', 'topic');
    
    // Create queues
    await rabbitMQService.createQueue('order-service.new-orders');
    await rabbitMQService.createQueue('order-service.order-updates');
    await rabbitMQService.createQueue('order-service.workflow-events');
    
    // Bind queues to exchanges
    await rabbitMQService.bindQueue('order-service.new-orders', 'swiftlogistics.orders', 'order.created');
    await rabbitMQService.bindQueue('order-service.order-updates', 'swiftlogistics.orders', 'order.updated');
    await rabbitMQService.bindQueue('order-service.workflow-events', 'swiftlogistics.workflow', 'workflow.*');
    
    // Start consuming messages
    await startMessageConsumers();
    
    console.log('✅ RabbitMQ consumers initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize RabbitMQ consumers:', error);
  }
}

// Start message consumers
async function startMessageConsumers() {
  try {
    // Consumer for new orders
    await rabbitMQService.consumeQueue('order-service.new-orders', async (message) => {
      console.log('📨 Processing new order:', message);
      await orderProcessor.processNewOrder(message);
    });
    
    // Consumer for order updates
    await rabbitMQService.consumeQueue('order-service.order-updates', async (message) => {
      console.log('📨 Processing order update:', message);
      await orderProcessor.processOrderUpdate(message);
    });
    
    // Consumer for workflow events
    await rabbitMQService.consumeQueue('order-service.workflow-events', async (message) => {
      console.log('📨 Processing workflow event:', message);
      await workflowEngine.processWorkflowEvent(message);
    });
    
    console.log('✅ Message consumers started successfully');
  } catch (error) {
    console.error('❌ Failed to start message consumers:', error);
  }
}

// Initialize scheduled tasks
function initializeScheduledTasks() {
  // Process pending orders every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('🕐 Running scheduled task: Process pending orders');
      await orderProcessor.processPendingOrders();
    } catch (error) {
      console.error('❌ Error in scheduled task - Process pending orders:', error);
    }
  });
  
  // Update order statuses every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      console.log('🕐 Running scheduled task: Update order statuses');
      await orderProcessor.updateOrderStatuses();
    } catch (error) {
      console.error('❌ Error in scheduled task - Update order statuses:', error);
    }
  });
  
  // Clean up old orders every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('🕐 Running scheduled task: Clean up old orders');
      await orderProcessor.cleanupOldOrders();
    } catch (error) {
      console.error('❌ Error in scheduled task - Clean up old orders:', error);
    }
  });
  
  console.log('✅ Scheduled tasks initialized');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  await gracefulShutdown();
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
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
      console.log('✅ HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('❌ Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Initialize services and start server
async function startServer() {
  try {
    console.log('🚀 Starting SwiftLogistics Order Management Service...');
    
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
      await initializeConsumers();
    }
    
    // Initialize scheduled tasks
    initializeScheduledTasks();
    
    // Start server
    server.listen(PORT, () => {
      console.log(`✅ Order Management Service running on port ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`📡 WebSocket server ready`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start Order Management Service:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = { app, server, io };
