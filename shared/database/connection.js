const mongoose = require("mongoose");
const Redis = require("ioredis");

class DatabaseConnection {
  constructor() {
    this.mongoConnection = null;
    this.redisConnection = null;
  }

  // MongoDB Connection
  async connectMongoDB(uri) {
    try {
      if (this.mongoConnection) {
        return this.mongoConnection;
      }

      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      this.mongoConnection = await mongoose.connect(uri, options);

      mongoose.connection.on("connected", () => {
        console.log("✅ MongoDB connected successfully");
      });

      mongoose.connection.on("error", (err) => {
        console.error("❌ MongoDB connection error:", err);
      });

      mongoose.connection.on("disconnected", () => {
        console.log("⚠️ MongoDB disconnected");
      });

      // Graceful shutdown
      process.on("SIGINT", async () => {
        await this.closeMongoDB();
        process.exit(0);
      });

      return this.mongoConnection;
    } catch (error) {
      console.error("❌ Failed to connect to MongoDB:", error);
      throw error;
    }
  }

  async closeMongoDB() {
    try {
      if (this.mongoConnection) {
        await mongoose.connection.close();
        this.mongoConnection = null;
        console.log("✅ MongoDB connection closed");
      }
    } catch (error) {
      console.error("❌ Error closing MongoDB connection:", error);
    }
  }

  // Redis Connection
  async connectRedis(url) {
    try {
      if (this.redisConnection) {
        return this.redisConnection;
      }

      this.redisConnection = new Redis(url, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        lazyConnect: true,
        retryDelayOnClusterDown: 300,
        enableOfflineQueue: false,
        maxLoadingTimeout: 10000,
        retryDelayOnFailover: 100,
        retryDelayOnFailover: 100,
        retryDelayOnFailover: 100,
      });

      this.redisConnection.on("connect", () => {
        console.log("✅ Redis connected successfully");
      });

      this.redisConnection.on("error", (err) => {
        console.error("❌ Redis connection error:", err);
      });

      this.redisConnection.on("close", () => {
        console.log("⚠️ Redis connection closed");
      });

      this.redisConnection.on("ready", () => {
        console.log("✅ Redis is ready");
      });

      // Graceful shutdown
      process.on("SIGINT", async () => {
        await this.closeRedis();
        process.exit(0);
      });

      return this.redisConnection;
    } catch (error) {
      console.error("❌ Failed to connect to Redis:", error);
      throw error;
    }
  }

  async closeRedis() {
    try {
      if (this.redisConnection) {
        await this.redisConnection.quit();
        this.redisConnection = null;
        console.log("✅ Redis connection closed");
      }
    } catch (error) {
      console.error("❌ Error closing Redis connection:", error);
    }
  }

  // Health Check
  async healthCheck() {
    const status = {
      mongodb: "unknown",
      redis: "unknown",
      timestamp: new Date().toISOString(),
    };

    try {
      if (mongoose.connection.readyState === 1) {
        status.mongodb = "healthy";
      } else {
        status.mongodb = "unhealthy";
      }
    } catch (error) {
      status.mongodb = "error";
    }

    try {
      if (this.redisConnection && this.redisConnection.status === "ready") {
        status.redis = "healthy";
      } else {
        status.redis = "unhealthy";
      }
    } catch (error) {
      status.redis = "error";
    }

    return status;
  }
}

module.exports = new DatabaseConnection();
