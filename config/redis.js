const redis = require('redis');
const logger = require('./logger');

class RedisConnection {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = redis.createClient({
        url: redisUrl,
        password: process.env.REDIS_PASSWORD || undefined,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server connection refused');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            logger.error('Redis max retry attempts reached');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        logger.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        logger.info('🔗 Redis client connected');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        logger.info('✅ Redis client ready');
      });

      this.client.on('end', () => {
        this.isConnected = false;
        logger.info('🔌 Redis client disconnected');
      });

      await this.client.connect();
      
    } catch (error) {
      this.isConnected = false;
      logger.error('❌ Redis connection failed:', error);
      // Don't exit process for Redis failures - app can work without cache
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        this.isConnected = false;
        logger.info('🔌 Redis connection closed');
      }
    } catch (error) {
      logger.error('❌ Error closing Redis connection:', error);
    }
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected && this.client && this.client.isReady;
  }

  async set(key, value, expireInSeconds = 3600) {
    try {
      if (!this.isReady()) {
        logger.warn('Redis not available, skipping cache set');
        return false;
      }
      
      const serializedValue = JSON.stringify(value);
      await this.client.setEx(key, expireInSeconds, serializedValue);
      return true;
    } catch (error) {
      logger.error('Redis SET error:', error);
      return false;
    }
  }

  async get(key) {
    try {
      if (!this.isReady()) {
        logger.warn('Redis not available, skipping cache get');
        return null;
      }
      
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  async del(key) {
    try {
      if (!this.isReady()) {
        logger.warn('Redis not available, skipping cache delete');
        return false;
      }
      
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error:', error);
      return false;
    }
  }

  async exists(key) {
    try {
      if (!this.isReady()) {
        return false;
      }
      
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      return false;
    }
  }
}

module.exports = new RedisConnection();
