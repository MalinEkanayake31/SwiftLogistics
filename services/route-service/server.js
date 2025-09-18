const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const databaseService = require('./shared/database/connection');
const rabbitMQService = require('./shared/messaging/rabbitmq');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:8080",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Request logger
app.use((req, res, next) => {
  console.log(`📝 [${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    service: 'route-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mock ROS (Route Optimization System) integration endpoints
app.post('/api/ros/optimize', (req, res) => {
  const { addresses, vehicleAvailability } = req.body;
  
  // Simulate REST API call to ROS
  console.log(`🗺️ Calling ROS REST API to optimize route for ${addresses.length} addresses`);
  
  // Mock route optimization response
  const optimizedRoute = {
    routeId: `ROUTE${Date.now()}`,
    totalDistance: Math.floor(Math.random() * 100) + 20, // km
    estimatedTime: Math.floor(Math.random() * 120) + 30, // minutes
    waypoints: addresses.map((addr, index) => ({
      order: index + 1,
      address: addr,
      estimatedArrival: new Date(Date.now() + (index * 15 * 60000)).toISOString()
    })),
    optimizationScore: Math.random() * 0.3 + 0.7 // 0.7-1.0
  };
  
  res.json({
    success: true,
    message: 'Route optimized successfully',
    data: optimizedRoute
  });
});

app.get('/api/ros/routes/:routeId', (req, res) => {
  const { routeId } = req.params;
  
  // Mock getting route details from ROS
  res.json({
    success: true,
    data: {
      routeId,
      status: 'active',
      lastUpdated: new Date().toISOString(),
      currentLocation: 'Colombo',
      nextWaypoint: 'Galle'
    }
  });
});

// Socket.io for real-time route updates
io.on('connection', (socket) => {
  console.log('🔌 Client connected to Route Service:', socket.id);
  
  socket.on('join-route-room', (routeId) => {
    socket.join(`route-${routeId}`);
    console.log(`🗺️ Client ${socket.id} joined route room: ${routeId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected from Route Service:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await databaseService.closeMongoDB();
  await databaseService.closeRedis();
  await rabbitMQService.close();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  await databaseService.closeMongoDB();
  await databaseService.closeRedis();
  await rabbitMQService.close();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server
async function startServer() {
  try {
    // Connect to databases
    await databaseService.connectMongoDB(process.env.MONGODB_URI);
    await databaseService.connectRedis(process.env.REDIS_URL);
    
    // Connect to RabbitMQ
    await rabbitMQService.connect(process.env.RABBITMQ_URL);
    
    // Create exchanges and queues
    await rabbitMQService.createExchange('route-events', 'topic');
    await rabbitMQService.createQueue('route-updates', { durable: true });
    await rabbitMQService.bindQueue('route-updates', 'route-events', 'route.*');
    
    const PORT = process.env.PORT || 3003;
    server.listen(PORT, () => {
      console.log(`🚀 Route Service running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start Route Service:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, io };
