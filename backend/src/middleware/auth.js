const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret(), {
    expiresIn: config.jwtExpiresIn,
  });
}

/** Verifies the Bearer JWT and loads the current user (so deleted users lose access immediately). */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret());
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Role-based authorization. Usage: authorize('admin', 'doctor') */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to do that' });
  }
  next();
};

module.exports = { signToken, authenticate, authorize };
