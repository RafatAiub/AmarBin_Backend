const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.id).select('-passwordHash');
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
  }
}

module.exports = auth;
