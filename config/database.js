const mongoose = require('mongoose');
const logger = require('./logger');

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
  }

  async connect() {
    try {
      const mongoUri = process.env.MONGO_URI;
      
      if (!mongoUri) {
        throw new Error('MONGO_URI environment variable is not defined');
      }

      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
        retryWrites: true,
        retryReads: true,
        maxIdleTimeMS: 30000,
        minPoolSize: 2,
        maxConnecting: 2,
      };

      await mongoose.connect(mongoUri, options);
      
      this.isConnected = true;
      this.retryAttempts = 0;
      
      logger.info('✅ MongoDB connected successfully', {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        database: mongoose.connection.name
      });

      this.setupEventListeners();
      
    } catch (error) {
      this.isConnected = false;
      logger.error('❌ MongoDB connection failed:', error);
      
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        logger.info(`🔄 Retrying connection in ${this.retryDelay}ms (attempt ${this.retryAttempts}/${this.maxRetries})`);
        
        setTimeout(() => {
          this.connect();
        }, this.retryDelay);
      } else {
        logger.error('💀 Max retry attempts reached. Exiting...');
        process.exit(1);
      }
    }
  }

  setupEventListeners() {
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      logger.info('🔗 Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      this.isConnected = false;
      logger.error('❌ Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      logger.warn('⚠️ Mongoose disconnected from MongoDB');
    });

    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  async disconnect() {
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('🔌 MongoDB connection closed');
    } catch (error) {
      logger.error('❌ Error closing MongoDB connection:', error);
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      database: mongoose.connection.name
    };
  }
}

module.exports = new DatabaseConnection();
