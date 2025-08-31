const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const databaseService = require('../shared/database/connection');
const rabbitMQService = require('../shared/messaging/rabbitmq');

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
    service: 'client-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mock CMS integration endpoints
app.get('/api/cms/clients', (req, res) => {
  // Mock SOAP/XML response from CMS
  res.json({
    success: true,
    data: [
      {
        clientId: "CL001",
        name: "E-Commerce Plus",
        email: "orders@ecommerceplus.lk",
        contractType: "premium"
      }
    ]
  });
});

app.post('/api/cms/clients', (req, res) => {
  // Mock creating client in CMS via SOAP
  const { name, email, contractType } = req.body;
  
  // Simulate SOAP call to CMS
  console.log(`📞 Calling CMS SOAP API to create client: ${name}`);
  
  res.json({
    success: true,
    message: 'Client created successfully in CMS',
    data: {
      clientId: `CL${Date.now()}`,
      name,
      email,
      contractType,
      createdAt: new Date().toISOString()
    }
  });
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('🔌 Client connected to Client Service:', socket.id);
  
  socket.on('join-client-room', (clientId) => {
    socket.join(`client-${clientId}`);
    console.log(`👥 Client ${socket.id} joined room: client-${clientId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected from Client Service:', socket.id);
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
    await rabbitMQService.createExchange('client-events', 'topic');
    await rabbitMQService.createQueue('client-updates', { durable: true });
    await rabbitMQService.bindQueue('client-updates', 'client-events', 'client.*');
    
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`🚀 Client Service running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start Client Service:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, io };
