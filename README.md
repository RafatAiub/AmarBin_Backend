# 🗑️ AmarBin - Smart Waste Management System

[![Node.js](https://img.shields.io/badge/Node.js-18.0+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-green.svg)](https://www.mongodb.com/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19+-blue.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Security](https://img.shields.io/badge/Security-Enterprise%20Grade-red.svg)](#security-features)

A modern, enterprise-grade waste management backend API built with Node.js, Express, and MongoDB. Features comprehensive security, real-time updates, and scalable architecture.

## 🚀 Features

### 🔐 **Enterprise Security**
- JWT + Refresh Token authentication
- Rate limiting & DDoS protection
- Account lockout after failed attempts
- Password complexity requirements
- Input sanitization & XSS protection
- CORS & security headers (Helmet.js)
- Request validation & error handling

### 📊 **Smart Management**
- Real-time pickup tracking
- Role-based access control (Admin/Employee/Customer)
- Geolocation support
- Waste type categorization
- Priority-based scheduling
- Customer feedback system

### ⚡ **Performance & Scalability**
- MongoDB connection pooling
- Redis caching (optional)
- Database indexing optimization
- Pagination & filtering
- Graceful shutdown handling
- Health check endpoints

### 🔧 **Developer Experience**
- Comprehensive API documentation (Swagger)
- Structured logging (Winston)
- Environment-based configuration
- Error tracking & monitoring
- Automated validation

## 📋 Prerequisites

- **Node.js** 18.0+ 
- **MongoDB** 6.0+
- **Redis** 6.0+ (optional, for caching)
- **npm** 8.0+

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/amarbin-backend.git
cd amarbin-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 4. Database setup
```bash
# Start MongoDB (if local)
mongod

# Create admin user
npm run create-admin
```

### 5. Start the server
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | ✅ |
| `PORT` | Server port | `5000` | ✅ |
| `MONGO_URI` | MongoDB connection string | - | ✅ |
| `JWT_SECRET` | JWT signing secret (32+ chars) | - | ✅ |
| `JWT_REFRESH_SECRET` | Refresh token secret (32+ chars) | - | ✅ |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` | ❌ |
| `CORS_ORIGIN` | Allowed origins | `http://localhost:3000` | ❌ |

### Security Configuration

```env
# Security settings
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=15
PASSWORD_MIN_LENGTH=8

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Interactive Documentation
Visit `http://localhost:5000/api-docs` for complete Swagger documentation.

### Quick Start Examples

#### Register a new user
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "phone": "+1234567890"
  }'
```

#### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

#### Create pickup request
```bash
curl -X POST http://localhost:5000/api/pickups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "John Doe",
    "phone": "+1234567890",
    "address": "123 Main St, City, State",
    "wasteType": "general",
    "estimatedWeight": 5
  }'
```

## 🏗️ Architecture

```
├── config/           # Configuration files
│   ├── database.js   # MongoDB connection
│   ├── logger.js     # Winston logging
│   └── redis.js      # Redis connection
├── middleware/       # Express middleware
│   ├── auth.js       # Authentication
│   ├── errorHandler.js # Error handling
│   ├── role.js       # Authorization
│   └── security.js   # Security middleware
├── models/           # Mongoose models
│   ├── User.js       # User model
│   └── PickupRequest.js # Pickup model
├── routes/           # API routes
│   ├── auth.js       # Authentication routes
│   ├── admin.js      # Admin routes
│   └── pickups.js    # Pickup routes
├── utils/            # Utility functions
│   ├── helpers.js    # Common helpers
│   └── validation.js # Validation schemas
├── scripts/          # Utility scripts
└── server.js         # Main application
```

## 🔒 Security Features

- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-based access control
- **Rate Limiting**: Configurable request limits
- **Input Validation**: Multi-layer validation
- **Data Sanitization**: XSS and injection protection
- **Security Headers**: Helmet.js implementation
- **Account Security**: Lockout and attempt tracking
- **Password Security**: Bcrypt with configurable rounds
- **CORS Protection**: Configurable origin validation

## 🚀 Deployment

### Docker (Recommended)
```bash
# Build image
docker build -t amarbin-backend .

# Run container
docker run -p 5000:5000 --env-file .env amarbin-backend
```

### PM2 (Production)
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor
pm2 monit
```

### Environment-specific deployment
```bash
# Staging
npm run deploy:staging

# Production
npm run deploy:production
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:5000/health
```

### Logs
```bash
# View logs
tail -f logs/combined.log

# Error logs only
tail -f logs/error.log
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@amarbin.com
- 📖 Documentation: [API Docs](http://localhost:5000/api-docs)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/amarbin-backend/issues)

## 🙏 Acknowledgments

- Express.js team for the robust framework
- MongoDB team for the excellent database
- All contributors who helped improve this project

---

**Built with ❤️ for a cleaner environment** 🌱
