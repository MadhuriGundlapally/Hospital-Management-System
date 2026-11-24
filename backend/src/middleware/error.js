const logger = require('../logger');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
  if (err.code === 11000) return res.status(409).json({ error: 'Duplicate value', details: Object.keys(err.keyValue || {}) });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  logger.error('unhandled_error', { message: err.message, stack: err.stack, path: req.originalUrl });
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { asyncHandler, notFound, errorHandler };
