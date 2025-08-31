const amqp = require('amqplib');

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.queues = new Set();
    this.exchanges = new Set();
  }

  async connect(url) {
    try {
      if (this.connection) {
        return this.connection;
      }

      this.connection = await amqp.connect(url);
      
      this.connection.on('error', (err) => {
        console.error('❌ RabbitMQ connection error:', err);
        this.connection = null;
        this.channel = null;
      });

      this.connection.on('close', () => {
        console.log('⚠️ RabbitMQ connection closed');
        this.connection = null;
        this.channel = null;
      });

      this.channel = await this.connection.createChannel();
      
      this.channel.on('error', (err) => {
        console.error('❌ RabbitMQ channel error:', err);
      });

      this.channel.on('return', (msg) => {
        console.log('⚠️ RabbitMQ message returned:', msg);
      });

      console.log('✅ RabbitMQ connected successfully');
      return this.connection;
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async createQueue(queueName, options = {}) {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not available');
      }

      const defaultOptions = {
        durable: true,
        autoDelete: false,
        arguments: {}
      };

      const queueOptions = { ...defaultOptions, ...options };
      
      await this.channel.assertQueue(queueName, queueOptions);
      this.queues.add(queueName);
      
      console.log(`✅ Queue '${queueName}' created/verified`);
      return queueName;
    } catch (error) {
      console.error(`❌ Failed to create queue '${queueName}':`, error);
      throw error;
    }
  }

  async createExchange(exchangeName, type = 'topic', options = {}) {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not available');
      }

      const defaultOptions = {
        durable: true,
        autoDelete: false,
        arguments: {}
      };

      const exchangeOptions = { ...defaultOptions, ...options };
      
      await this.channel.assertExchange(exchangeName, type, exchangeOptions);
      this.exchanges.add(exchangeName);
      
      console.log(`✅ Exchange '${exchangeName}' created/verified`);
      return exchangeName;
    } catch (error) {
      console.error(`❌ Failed to create exchange '${exchangeName}':`, error);
      throw error;
    }
  }

  async bindQueue(queueName, exchangeName, routingKey) {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not available');
      }

      await this.channel.bindQueue(queueName, exchangeName, routingKey);
      console.log(`✅ Queue '${queueName}' bound to exchange '${exchangeName}' with routing key '${routingKey}'`);
    } catch (error) {
      console.error(`❌ Failed to bind queue '${queueName}' to exchange '${exchangeName}':`, error);
      throw error;
    }
  }

  async publishMessage(exchangeName, routingKey, message, options = {}) {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not available');
      }

      const defaultOptions = {
        persistent: true,
        mandatory: true,
        timestamp: Date.now()
      };

      const publishOptions = { ...defaultOptions, ...options };
      
      const messageBuffer = Buffer.isBuffer(message) ? message : Buffer.from(JSON.stringify(message));
      
      const result = this.channel.publish(exchangeName, routingKey, messageBuffer, publishOptions);
      
      if (result) {
        console.log(`✅ Message published to exchange '${exchangeName}' with routing key '${routingKey}'`);
      } else {
        console.warn(`⚠️ Message not published to exchange '${exchangeName}' with routing key '${routingKey}'`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to publish message to exchange '${exchangeName}':`, error);
      throw error;
    }
  }

  async sendToQueue(queueName, message, options = {}) {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not available');
      }

      const defaultOptions = {
        persistent: true,
        timestamp: Date.now()
      };

      const sendOptions = { ...defaultOptions, ...options };
      
      const messageBuffer = Buffer.isBuffer(message) ? message : Buffer.from(JSON.stringify(message));
      
      const result = this.channel.sendToQueue(queueName, messageBuffer, sendOptions);
      
      if (result) {
        console.log(`✅ Message sent to queue '${queueName}'`);
      } else {
        console.warn(`⚠️ Message not sent to queue '${queueName}'`);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to send message to queue '${queueName}':`, error);
      throw error;
    }
  }

  async consumeQueue(queueName, callback, options = {}) {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not available');
      }

      const defaultOptions = {
        noAck: false,
        prefetch: 1
      };

      const consumeOptions = { ...defaultOptions, ...options };
      
      // Set prefetch for fair dispatch
      await this.channel.prefetch(consumeOptions.prefetch);
      
      const result = await this.channel.consume(queueName, async (msg) => {
        try {
          if (msg) {
            const content = JSON.parse(msg.content.toString());
            console.log(`📨 Message received from queue '${queueName}':`, content);
            
            await callback(content, msg);
            
            if (!consumeOptions.noAck) {
              this.channel.ack(msg);
            }
          }
        } catch (error) {
          console.error(`❌ Error processing message from queue '${queueName}':`, error);
          
          if (!consumeOptions.noAck) {
            // Reject the message and requeue it
            this.channel.nack(msg, false, true);
          }
        }
      }, consumeOptions);
      
      console.log(`✅ Consumer started for queue '${queueName}'`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to start consumer for queue '${queueName}':`, error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      
      console.log('✅ RabbitMQ connection closed');
    } catch (error) {
      console.error('❌ Error closing RabbitMQ connection:', error);
    }
  }

  // Health Check
  async healthCheck() {
    try {
      if (this.connection && this.channel) {
        return {
          status: 'healthy',
          connection: 'connected',
          channel: 'open',
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          connection: 'disconnected',
          channel: 'closed',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new RabbitMQService();
